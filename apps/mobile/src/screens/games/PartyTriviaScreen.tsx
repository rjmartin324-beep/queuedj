import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, Dimensions, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const { width: SW } = Dimensions.get("window");

const QUESTIONS = [
  { q: "Which planet is known as the Red Planet?", opts: ["Venus", "Mars", "Jupiter", "Saturn"], a: 1 },
  { q: "Who painted the Mona Lisa?", opts: ["Van Gogh", "Picasso", "Da Vinci", "Monet"], a: 2 },
  { q: "What is the capital of Japan?", opts: ["Seoul", "Beijing", "Bangkok", "Tokyo"], a: 3 },
  { q: "Which element has the symbol 'O'?", opts: ["Gold", "Oxygen", "Osmium", "Oganesson"], a: 1 },
  { q: "How many sides does a hexagon have?", opts: ["5", "6", "7", "8"], a: 1 },
  { q: "Which ocean is the largest?", opts: ["Atlantic", "Indian", "Arctic", "Pacific"], a: 3 },
  { q: "What year did WWII end?", opts: ["1943", "1944", "1945", "1946"], a: 2 },
  { q: "Who wrote 'Romeo and Juliet'?", opts: ["Dickens", "Shakespeare", "Austen", "Twain"], a: 1 },
  { q: "What is the fastest land animal?", opts: ["Lion", "Cheetah", "Gazelle", "Horse"], a: 1 },
  { q: "How many bones are in the adult human body?", opts: ["196", "206", "216", "226"], a: 1 },
];

type Phase = "lobby" | "playing" | "results";

export default function PartyTriviaScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpAnswered, setMpAnswered] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(10);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [lastPoints, setLastPoints] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerTickRef = useRef(10); // mirrors timer state, used for side-effect-safe countdown
  const barAnim = useRef(new Animated.Value(1)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const countdownAnim = useRef(new Animated.Value(0)).current;
  const [lobbyCount, setLobbyCount] = useState(3);
  const lobbyRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lobbyTickRef = useRef(3);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current!);
      clearInterval(lobbyRef.current!);
    };
  }, []);

  if (inRoom && mpState) {
    const mp = mpState;
    const mpPhase: string = mp.phase ?? "waiting";

    if (mpPhase === "finished") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 20 }}>Final Leaderboard</Text>
              {Object.entries(mpState.scores ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([gid, pts], i) => (
                <View key={gid} style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
                  <Text style={{ color: "#ccc", fontSize: 16 }}>#{i + 1} {memberName(gid)}{gid === myGuestId ? " (you)" : ""}</Text>
                  <Text style={{ color: "#a78bfa", fontSize: 16, fontWeight: "700" }}>{pts as number} pts</Text>
                </View>
              ))}
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, padding: 12 }}>
                <Text style={{ color: "#666" }}>Back to Home</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" }}>Waiting for game to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "question") {
      const opts: string[] = mp.options ?? [];
      const correctIdx: number = mp.correctIndex ?? -1;
      const myAns = mp.answers?.[myGuestId ?? ""];
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ color: "#888", fontWeight: "700" }}>Q {(mp.questionIndex ?? 0) + 1}</Text>
              <Text style={{ color: "#a78bfa", fontWeight: "800" }}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", lineHeight: 28, marginBottom: 32 }}>{mp.question}</Text>
              <View style={{ gap: 10 }}>
                {opts.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { if (!myAns && !mpAnswered) { setMpAnswered(true); sendAction("answer", { optionIndex: i }); } }}
                    disabled={!!myAns || mpAnswered}
                    activeOpacity={0.8}
                    style={{ borderRadius: 14, overflow: "hidden" }}
                  >
                    <LinearGradient colors={(myAns === i || mpAnswered) ? ["#7209b7", "#b5179e"] : ["#1a1a3a", "#2a1a4a"]} style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 10 }}>
                      <Text style={{ color: "#a78bfa", fontSize: 15, fontWeight: "900", width: 22 }}>{["A", "B", "C", "D"][i]}</Text>
                      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600", flex: 1 }}>{opt}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
              {(myAns !== undefined || mpAnswered) && <Text style={{ color: "#888", fontSize: 14, textAlign: "center", marginTop: 16 }}>⏳ Waiting for others…</Text>}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const opts: string[] = mp.options ?? [];
      const correctIdx: number = mp.correctIndex ?? -1;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 8 }}>CORRECT ANSWER</Text>
              <Text style={{ color: "#4ade80", fontSize: 20, fontWeight: "900", marginBottom: 20, textAlign: "center" }}>{opts[correctIdx] ?? "?"}</Text>
              {Object.entries(mp.scores ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([gid, pts], i) => (
                <View key={gid} style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
                  <Text style={{ color: "#ccc", fontSize: 15 }}>#{i + 1} {memberName(gid)}</Text>
                  <Text style={{ color: "#a78bfa", fontSize: 15, fontWeight: "700" }}>{pts as number} pts</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#888", fontSize: 16 }}>Phase: {mpPhase}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  function startLobby() {
    clearInterval(lobbyRef.current!);
    clearInterval(timerRef.current!);
    lobbyRef.current = null;
    timerRef.current = null;
    lobbyTickRef.current = 3;
    setLobbyCount(3);
    setPhase("lobby");
    countdownAnim.setValue(0);
    lobbyRef.current = setInterval(() => {
      // Decrement via ref so side effects run exactly once (not inside a state updater).
      lobbyTickRef.current -= 1;
      setLobbyCount(lobbyTickRef.current);
      if (lobbyTickRef.current <= 0) {
        clearInterval(lobbyRef.current!);
        lobbyRef.current = null;
        startGame();
      }
    }, 1000);
  }

  function startGame() {
    setPhase("playing");
    setRound(0);
    setScore(0);
    nextQuestion(0);
  }

  function nextQuestion(idx: number) {
    clearInterval(timerRef.current!);
    timerRef.current = null;
    timerTickRef.current = 10;
    setSelected(null);
    setAnswered(false);
    setTimer(10);
    barAnim.setValue(1);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.timing(barAnim, { toValue: 0, duration: 10000, useNativeDriver: false }).start();
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        const next = t - 1;
        if (next <= 0) {
          // Side effects must NOT live inside the state updater (React can call it twice).
          // Schedule them synchronously after the tick via a plain ref check.
          return 0;
        }
        return next;
      });
      // Separate check so clearInterval / handleTimeout run exactly once per tick.
      if (timerRef.current) {
        // We can't read the new timer state here, so track via a ref.
        timerTickRef.current -= 1;
        if (timerTickRef.current <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          handleTimeout(idx);
        }
      }
    }, 1000);
  }

  function handleTimeout(idx: number) {
    setAnswered(true);
    setLastPoints(0);
    advance(idx);
  }

  function handleAnswer(optIdx: number, currentRound: number) {
    if (answered) return;
    clearInterval(timerRef.current!);
    timerRef.current = null;
    timerTickRef.current = 0;
    barAnim.stopAnimation();
    setSelected(optIdx);
    setAnswered(true);
    const correct = QUESTIONS[currentRound].a === optIdx;
    const pts = correct ? Math.round(100 + timer * 40) : 0;
    setLastPoints(pts);
    setScore((s) => s + pts);
    Animated.sequence([
      Animated.timing(scoreAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(scoreAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    advance(currentRound);
  }

  function advance(idx: number) {
    setTimeout(() => {
      if (idx + 1 >= QUESTIONS.length) {
        setPhase("results");
      } else {
        setRound(idx + 1);
        nextQuestion(idx + 1);
      }
    }, 1200);
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#0d0060"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={s.gameEmoji}>❓</Text>
            <Text style={s.gameTitle}>Party Trivia</Text>
            <Text style={s.gameSub}>10 rounds · 10 seconds each · tap fast for bonus points</Text>
            <View style={s.rulesBox}>
              {["4 multiple choice options per question", "Faster answers = more points (up to 500)", "Points reset each session"].map((r, i) => (
                <Text key={i} style={s.ruleItem}>• {r}</Text>
              ))}
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startLobby}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>START GAME</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  if (phase === "results") {
    const maxPts = QUESTIONS.length * 500;
    const pct = Math.round((score / maxPts) * 100);
    const grade = pct >= 90 ? "🏆 Trivia God" : pct >= 70 ? "⭐ Sharp Mind" : pct >= 50 ? "🙂 Not Bad" : "💀 Keep Trying";
    return (
      <LinearGradient colors={["#03001c", "#0d0060"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>🎉</Text>
            <Text style={s.resultsTitle}>Round Complete!</Text>
            <Text style={s.resultsScore}>{score}</Text>
            <Text style={s.resultsLabel}>TOTAL POINTS</Text>
            <View style={s.gradeBox}>
              <Text style={s.gradeText}>{grade}</Text>
            </View>
            <Text style={{ color: "#888", marginBottom: 32 }}>
              {pct}% of max score
            </Text>
            <TouchableOpacity style={s.startBtn} onPress={startLobby}>
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

  // ── Playing ────────────────────────────────────────────────────────────────
  const q = QUESTIONS[round];
  return (
    <LinearGradient colors={["#03001c", "#0d0060"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.timerRow}>
          <Text style={s.roundText}>Q {round + 1}/{QUESTIONS.length}</Text>
          <View style={s.timerBg}>
            <Animated.View style={[s.timerBar, {
              width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              backgroundColor: timer <= 3 ? "#ef4444" : "#b5179e",
            }]} />
          </View>
          <Text style={[s.timerNum, { color: timer <= 3 ? "#ef4444" : "#fff" }]}>{timer}s</Text>
        </View>

        <Animated.View style={[s.questionBox, { opacity: fadeAnim }]}>
          <Text style={s.questionText}>{q.q}</Text>
        </Animated.View>

        <View style={s.optionsGrid}>
          {q.opts.map((opt, idx) => {
            const isCorrect = q.a === idx;
            const isSelected = selected === idx;
            let bg: string[] = ["#1a1a3a", "#2a1a4a"];
            if (answered) {
              if (isCorrect) bg = ["#166534", "#15803d"];
              else if (isSelected) bg = ["#7f1d1d", "#991b1b"];
            }
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleAnswer(idx, round)}
                disabled={answered}
                activeOpacity={0.8}
                style={s.optWrap}
              >
                <LinearGradient colors={bg as any} style={s.optBtn}>
                  <Text style={s.optLetter}>
                    {["A", "B", "C", "D"][idx]}
                  </Text>
                  <Text style={s.optText}>{opt}</Text>
                  {answered && isCorrect && <Text style={{ fontSize: 18 }}>✓</Text>}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        {answered && lastPoints > 0 && (
          <Animated.View style={[s.pointsPop, { transform: [{ scale: scoreAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] }) }] }]}>
            <Text style={s.pointsPopText}>+{lastPoints} pts</Text>
          </Animated.View>
        )}

        <View style={s.scoreBar}>
          <Text style={s.scoreText}>Score: {score}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  back: { padding: 16, paddingTop: 8 },
  backText: { color: "#a78bfa", fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  gameEmoji: { fontSize: 72, marginBottom: 16 },
  gameTitle: { color: "#fff", fontSize: 32, fontWeight: "900", marginBottom: 8 },
  gameSub: { color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12 },
  homeBtnText: { color: "#666", fontSize: 15 },

  timerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 10 },
  roundText: { color: "#888", fontSize: 13, fontWeight: "700", width: 60 },
  timerBg: { flex: 1, height: 6, backgroundColor: "#1e1e3a", borderRadius: 3, overflow: "hidden" },
  timerBar: { height: "100%", borderRadius: 3 },
  timerNum: { fontSize: 15, fontWeight: "900", width: 30, textAlign: "right" },

  questionBox: { paddingHorizontal: 20, paddingVertical: 24 },
  questionText: { color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center", lineHeight: 30 },

  optionsGrid: { paddingHorizontal: 16, gap: 10, flex: 1, justifyContent: "center" },
  optWrap: { borderRadius: 14, overflow: "hidden" },
  optBtn: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12, borderRadius: 14 },
  optLetter: { color: "#a78bfa", fontSize: 16, fontWeight: "900", width: 24 },
  optText: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 },

  pointsPop: { alignItems: "center", marginTop: 8 },
  pointsPopText: { color: "#fbbf24", fontSize: 24, fontWeight: "900" },

  scoreBar: { padding: 20, alignItems: "center" },
  scoreText: { color: "#a78bfa", fontSize: 16, fontWeight: "800" },

  resultsTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 16 },
  resultsScore: { color: "#b5179e", fontSize: 72, fontWeight: "900" },
  resultsLabel: { color: "#555", fontSize: 12, letterSpacing: 2, marginBottom: 20 },
  gradeBox: { backgroundColor: "rgba(177,23,158,0.15)", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginBottom: 12 },
  gradeText: { color: "#e879f9", fontSize: 20, fontWeight: "800" },
});
