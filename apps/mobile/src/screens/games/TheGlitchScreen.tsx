import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { PostGameCard } from "../../components/shared/PostGameCard";

const ACCENT = "#818cf8";
const TOTAL_ROUNDS = 10;
const TIMER_SECONDS = 30;

const ALL_GLITCHES = [
  { answer: "The Lion King", clues: ["A young prince flees after a tragedy", "Talking animals in an African savanna", "Hakuna Matata"] },
  { answer: "Harry Potter", clues: ["A boy finds out he's famous in a hidden world", "Quidditch and wand fights", "Hogwarts School of Witchcraft"] },
  { answer: "The Dark Knight", clues: ["A billionaire fights crime at night", "A clown villain who loves chaos", "Gotham City"] },
  { answer: "Titanic", clues: ["A luxury ship on its maiden voyage", "A love story across social classes", "The unsinkable ship"] },
  { answer: "Breaking Bad", clues: ["A chemistry teacher makes questionable career choices", "Blue product in the desert", "Say my name"] },
  { answer: "Friends", clues: ["Six people in New York share coffee and secrets", "A coffee shop called Central Perk", "We were on a break!"] },
  { answer: "The Office", clues: ["A mockumentary set in a paper company", "A boss who thinks he's hilarious", "Dunder Mifflin"] },
  { answer: "Avengers: Endgame", clues: ["Half of all life disappeared five years ago", "Time travel and infinity stones", "I am Iron Man"] },
  { answer: "Stranger Things", clues: ["Kids in the 80s discover a government experiment gone wrong", "A girl with psychic powers", "The Upside Down"] },
  { answer: "Game of Thrones", clues: ["Noble families fight for a metal chair", "Dragons and a wall of ice", "Winter is Coming"] },
  { answer: "Interstellar", clues: ["A farmer becomes an astronaut to save humanity", "A black hole and time dilation", "Do not go gentle"] },
  { answer: "The Matrix", clues: ["A hacker discovers reality is a simulation", "A choice between two pills", "There is no spoon"] },
  { answer: "Shrek", clues: ["An ogre lives in a swamp and hates visitors", "A talking donkey becomes an unlikely friend", "Far Far Away"] },
  { answer: "The Simpsons", clues: ["A yellow family in Springfield", "D'oh!", "Homer Simpson"] },
  { answer: "Inception", clues: ["A team enters people's dreams to steal secrets", "A spinning top that never stops", "We need to go deeper"] },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function buildOptions(correct: string, allAnswers: string[]): string[] {
  const decoys = allAnswers.filter((a) => a !== correct);
  const shuffledDecoys = pickRandom(decoys, 3);
  const opts = [correct, ...shuffledDecoys];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

type Phase = "welcome" | "playing" | "results";

export default function TheGlitchScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [rounds, setRounds] = useState<typeof ALL_GLITCHES>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [clueIndex, setClueIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [answered, setAnswered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allAnswers = ALL_GLITCHES.map((g) => g.answer);

  function startGame() {
    const picked = pickRandom(ALL_GLITCHES, TOTAL_ROUNDS);
    setRounds(picked);
    setRoundIndex(0);
    setClueIndex(0);
    setScore(0);
    setSelected(null);
    setAnswered(false);
    setTimeLeft(TIMER_SECONDS);
    setOptions(buildOptions(picked[0].answer, allAnswers));
    setPhase("playing");
  }

  useEffect(() => {
    if (phase !== "playing" || answered) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleAnswer(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase, roundIndex, answered]);

  function revealNextClue() {
    if (clueIndex < 2) setClueIndex((c) => c + 1);
  }

  function handleAnswer(choice: string | null) {
    if (answered) return;
    clearInterval(timerRef.current!);
    setAnswered(true);
    setSelected(choice);
    const current = rounds[roundIndex];
    if (choice === current.answer) {
      const pts = clueIndex === 0 ? 300 : clueIndex === 1 ? 200 : 100;
      setScore((s) => s + pts);
    }
  }

  function nextRound() {
    const next = roundIndex + 1;
    if (next >= rounds.length) {
      setPhase("results");
      return;
    }
    setRoundIndex(next);
    setClueIndex(0);
    setSelected(null);
    setAnswered(false);
    setTimeLeft(TIMER_SECONDS);
    setOptions(buildOptions(rounds[next].answer, allAnswers));
  }

  if (phase === "welcome") {
    return (
      <LinearGradient colors={["#080820", "#08081a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={s.emoji}>📺</Text>
            <Text style={s.title}>The Glitch</Text>
            <Text style={s.sub}>Guess the movie or TV show from cryptic clues</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• {TOTAL_ROUNDS} rounds, 30s per round</Text>
              <Text style={s.ruleItem}>• 300 pts — guess after 1st clue</Text>
              <Text style={s.ruleItem}>• 200 pts — guess after 2nd clue</Text>
              <Text style={s.ruleItem}>• 100 pts — guess after 3rd clue</Text>
              <Text style={s.ruleItem}>• 4 multiple choice options</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#4f46e5", ACCENT]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>START</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "results") {
    return (
      <PostGameCard
        score={score}
        maxScore={3000}
        gameEmoji="👾"
        gameTitle="The Glitch"
        onPlayAgain={startGame}
      />
    );
  }

  const current = rounds[roundIndex];
  const timerColor = timeLeft > 15 ? ACCENT : timeLeft > 8 ? "#fbbf24" : "#f87171";

  return (
    <LinearGradient colors={["#080820", "#08081a"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        {/* Top bar */}
        <View style={s.topBar}>
          <Text style={s.roundPill}>{roundIndex + 1} / {TOTAL_ROUNDS}</Text>
          <View style={s.timerBadge}>
            <Text style={[s.timerText, { color: timerColor }]}>{timeLeft}s</Text>
          </View>
          <Text style={s.scoreChip}>{score} pts</Text>
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Clue cards */}
          <View style={s.clueSection}>
            {[0, 1, 2].map((ci) => (
              <View
                key={ci}
                style={[
                  s.clueCard,
                  ci > clueIndex && s.clueCardHidden,
                  ci === clueIndex && !answered && s.clueCardActive,
                ]}
              >
                <Text style={s.clueNum}>Clue {ci + 1}</Text>
                {ci <= clueIndex ? (
                  <Text style={s.clueText}>{current.clues[ci]}</Text>
                ) : (
                  <Text style={s.clueLocked}>???</Text>
                )}
              </View>
            ))}
          </View>

          {/* Reveal next clue button */}
          {!answered && clueIndex < 2 && (
            <TouchableOpacity style={s.revealBtn} onPress={revealNextClue}>
              <Text style={s.revealBtnText}>Next Clue →</Text>
            </TouchableOpacity>
          )}

          {/* Answer options */}
          <View style={s.optionsSection}>
            {options.map((opt) => {
              let bg = "rgba(129,140,248,0.08)";
              let border = "rgba(129,140,248,0.2)";
              let textColor = "#fff";
              if (answered) {
                if (opt === current.answer) { bg = "rgba(74,222,128,0.15)"; border = "#4ade80"; textColor = "#4ade80"; }
                else if (opt === selected) { bg = "rgba(248,113,113,0.15)"; border = "#f87171"; textColor = "#f87171"; }
              } else if (opt === selected) {
                bg = "rgba(129,140,248,0.2)"; border = ACCENT;
              }
              return (
                <TouchableOpacity
                  key={opt}
                  style={[s.optionBtn, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => !answered && handleAnswer(opt)}
                  disabled={answered}
                  activeOpacity={0.75}
                >
                  <Text style={[s.optionText, { color: textColor }]}>{opt}</Text>
                  {answered && opt === current.answer && <Text style={s.optionCheck}> ✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Points feedback + next */}
          {answered && (
            <View style={s.feedbackArea}>
              {selected === current.answer ? (
                <Text style={s.feedbackCorrect}>
                  +{clueIndex === 0 ? 300 : clueIndex === 1 ? 200 : 100} pts!
                </Text>
              ) : (
                <Text style={s.feedbackWrong}>
                  {selected === null ? "Time's up!" : "Not quite!"} — it was {current.answer}
                </Text>
              )}
              <TouchableOpacity style={s.nextBtn} onPress={nextRound}>
                <Text style={s.nextBtnText}>
                  {roundIndex + 1 >= rounds.length ? "See Results" : "Next Round →"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  back: { padding: 16, paddingTop: 8 },
  backText: { color: ACCENT, fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emoji: { fontSize: 64, marginBottom: 16, textAlign: "center" },
  title: { color: "#fff", fontSize: 30, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub: { color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12 },
  homeBtnText: { color: "#666", fontSize: 15 },
  bigScore: { color: ACCENT, fontSize: 72, fontWeight: "900" },
  scoreLabel: { color: "#555", fontSize: 14, letterSpacing: 1, marginBottom: 8 },
  resultComment: { color: "#888", fontSize: 15, textAlign: "center", marginBottom: 32, paddingHorizontal: 16 },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  roundPill: { color: "#888", fontWeight: "700", fontSize: 13 },
  scoreChip: { color: ACCENT, fontWeight: "800", fontSize: 14 },
  timerBadge: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  timerText: { fontSize: 15, fontWeight: "900" },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  clueSection: { gap: 10, marginBottom: 16 },
  clueCard: {
    backgroundColor: "rgba(129,140,248,0.06)",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.15)",
    borderRadius: 16,
    padding: 16,
  },
  clueCardActive: { borderColor: "rgba(129,140,248,0.4)", backgroundColor: "rgba(129,140,248,0.1)" },
  clueCardHidden: { opacity: 0.4 },
  clueNum: { color: ACCENT, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginBottom: 6 },
  clueText: { color: "#fff", fontSize: 16, fontWeight: "600", lineHeight: 22 },
  clueLocked: { color: "#444", fontSize: 16, fontWeight: "700" },

  revealBtn: { alignSelf: "center", backgroundColor: "rgba(129,140,248,0.12)", borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  revealBtnText: { color: ACCENT, fontSize: 14, fontWeight: "800" },

  optionsSection: { gap: 10, marginBottom: 16 },
  optionBtn: { borderRadius: 14, borderWidth: 1.5, padding: 16, flexDirection: "row", alignItems: "center" },
  optionText: { fontSize: 16, fontWeight: "700", flex: 1 },
  optionCheck: { color: "#4ade80", fontSize: 18, fontWeight: "900" },

  feedbackArea: { alignItems: "center", paddingTop: 8 },
  feedbackCorrect: { color: "#4ade80", fontSize: 22, fontWeight: "900", marginBottom: 16 },
  feedbackWrong: { color: "#f87171", fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 16 },
  nextBtn: { backgroundColor: "rgba(129,140,248,0.12)", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  nextBtnText: { color: ACCENT, fontSize: 16, fontWeight: "800" },
});
