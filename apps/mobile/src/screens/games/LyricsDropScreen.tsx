import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const LYRICS = [
  {
    song: "Bohemian Rhapsody – Queen",
    lines: ["Is this the real life?", "Is this just ___?", "Caught in a landslide"],
    blank: 1,
    answer: "fantasy",
    hint: "Not reality…",
  },
  {
    song: "Shape of You – Ed Sheeran",
    lines: ["I'm in love with the shape of ___", "We push and pull like a magnet do", "Although my heart is falling too"],
    blank: 0,
    answer: "you",
    hint: "A pronoun",
  },
  {
    song: "Blinding Lights – The Weeknd",
    lines: ["I've been on my own for long enough", "Maybe you can show me how to love", "I'm going through withdrawals"],
    blank: 2,
    answer: "withdrawals",
    hint: "What an addict experiences",
  },
  {
    song: "Rolling in the Deep – Adele",
    lines: ["We could have had it all", "___ in the deep", "You had my heart inside of your hands"],
    blank: 1,
    answer: "rolling",
    hint: "Moving with momentum",
  },
  {
    song: "Uptown Funk – Bruno Mars",
    lines: ["Don't believe me, just ___", "Don't believe me, just watch", "Stop! Wait a minute"],
    blank: 0,
    answer: "watch",
    hint: "Look at it",
  },
  {
    song: "Smells Like Teen Spirit – Nirvana",
    lines: ["Load up on guns, bring your ___", "It's fun to lose and to pretend", "She's over-bored and self-assured"],
    blank: 0,
    answer: "friends",
    hint: "People you care about",
  },
  {
    song: "Happy – Pharrell Williams",
    lines: ["It might seem crazy what I'm about to say", "___ — clap along if you feel like a room without a roof", "Because I'm happy"],
    blank: 1,
    answer: "sunshine",
    hint: "What comes from the sun",
  },
  {
    song: "Thriller – Michael Jackson",
    lines: ["'Cause this is ___", "Thriller night", "And no one's gonna save you from the beast about to strike"],
    blank: 0,
    answer: "thriller",
    hint: "The name of the song",
  },
];

type Phase = "lobby" | "playing" | "results";

export default function LyricsDropScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpGuess, setMpGuess] = useState("");
  const [mpGuessed, setMpGuessed] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [timer, setTimer] = useState(15);
  const [streak, setStreak] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    return () => clearInterval(timerRef.current!);
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
      return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, gap: 10 }}>
                <Text style={{ color: "#888", fontSize: 13, fontWeight: "700", width: 50 }}>Q {(mp.questionIndex ?? 0) + 1}</Text>
                <Text style={{ color: "#a78bfa", fontWeight: "800", marginLeft: "auto" }}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text>
              </View>
              {mp.songName && (
                <View style={{ marginHorizontal: 20, backgroundColor: "rgba(167,139,250,0.12)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                  <Text style={{ color: "#a78bfa", fontSize: 13, fontWeight: "700", textAlign: "center" }}>🎵 {mp.songName}</Text>
                </View>
              )}
              <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>
                {(mp.lines ?? []).map((line: string, lineIdx: number) => {
                  const isBlank = lineIdx === mp.blank;
                  if (isBlank) {
                    return (
                      <View key={lineIdx} style={{ alignItems: "center", gap: 8 }}>
                        <Text style={{ color: "#ccc", fontSize: 22, fontWeight: "600", textAlign: "center", lineHeight: 30 }}>{line.replace("___", "")}</Text>
                        <Text style={{ color: "#b5179e", fontSize: 28, fontWeight: "900" }}>[ ? ]</Text>
                      </View>
                    );
                  }
                  return <Text key={lineIdx} style={{ color: "#ccc", fontSize: 22, fontWeight: "600", textAlign: "center", lineHeight: 30 }}>{line}</Text>;
                })}
              </View>
              {mp.hint && <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}><Text style={{ color: "#555", fontSize: 13, textAlign: "center" }}>💡 Hint: {mp.hint}</Text></View>}
              {!mpGuessed ? (
                <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: "#1a1a3a", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 16 }}
                    value={mpGuess}
                    onChangeText={setMpGuess}
                    placeholder="Type the missing word…"
                    placeholderTextColor="#444"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={() => { if (mpGuess.trim()) { setMpGuessed(true); sendAction("guess", { text: mpGuess.trim() }); } }}
                  />
                  <TouchableOpacity onPress={() => { if (mpGuess.trim()) { setMpGuessed(true); sendAction("guess", { text: mpGuess.trim() }); } }} style={{ borderRadius: 14, overflow: "hidden" }}>
                    <LinearGradient colors={["#b5179e", "#7209b7"]} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>→</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ color: "#888", fontSize: 14, textAlign: "center", padding: 16 }}>⏳ Waiting for others…</Text>
              )}
            </SafeAreaView>
          </LinearGradient>
        </KeyboardAvoidingView>
      );
    }

    if (mpPhase === "reveal") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 8 }}>THE ANSWER WAS:</Text>
              <Text style={{ color: "#b5179e", fontSize: 32, fontWeight: "900", marginBottom: 20 }}>{mp.answer}</Text>
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

  function startGame() {
    setPhase("playing");
    setIdx(0);
    setScore(0);
    setStreak(0);
    resetRound(0);
  }

  function resetRound(roundIdx: number) {
    setAnswer("");
    setCorrect(false);
    setRevealed(false);
    setTimer(15);
    barAnim.setValue(1);
    clearInterval(timerRef.current!);

    Animated.timing(barAnim, { toValue: 0, duration: 15000, useNativeDriver: false }).start();
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleReveal(roundIdx, false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function checkAnswer(roundIdx: number) {
    clearInterval(timerRef.current!);
    barAnim.stopAnimation();
    const lyric = LYRICS[roundIdx];
    const isCorrect = answer.trim().toLowerCase() === lyric.answer.toLowerCase();
    setCorrect(isCorrect);
    handleReveal(roundIdx, isCorrect);
  }

  function handleReveal(roundIdx: number, isCorrect: boolean) {
    setRevealed(true);
    if (isCorrect) {
      const pts = 100 + timer * 20;
      setScore((s) => s + pts);
      setStreak((st) => st + 1);
    } else {
      setStreak(0);
    }
    feedbackAnim.setValue(0);
    Animated.spring(feedbackAnim, { toValue: 1, useNativeDriver: true, damping: 10 }).start();

    setTimeout(() => {
      if (roundIdx + 1 >= LYRICS.length) {
        setPhase("results");
      } else {
        setIdx(roundIdx + 1);
        resetRound(roundIdx + 1);
      }
    }, 1800);
  }

  useEffect(() => {
    return () => clearInterval(timerRef.current!);
  }, []);

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#0a0020"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>🎤</Text>
            <Text style={s.title}>Lyrics Drop</Text>
            <Text style={s.sub}>Song lyrics appear with one word blanked out — type the missing word before time runs out</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• 15 seconds per question</Text>
              <Text style={s.ruleItem}>• Faster answer = more points</Text>
              <Text style={s.ruleItem}>• {LYRICS.length} songs total</Text>
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
    return (
      <PostGameCard
        score={score}
        maxScore={1000}
        gameEmoji="🎤"
        gameTitle="Lyrics Drop"
        onPlayAgain={startGame}
      />
    );
  }

  const lyric = LYRICS[idx];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c", "#0a0020"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.timerRow}>
            <Text style={s.progress}>{idx + 1}/{LYRICS.length}</Text>
            <View style={s.timerTrack}>
              <Animated.View style={[s.timerFill, {
                width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                backgroundColor: timer <= 5 ? "#dc2626" : "#b5179e",
              }]} />
            </View>
            <Text style={[s.timerNum, { color: timer <= 5 ? "#dc2626" : "#fff" }]}>{timer}</Text>
          </View>

          <View style={s.songBadge}>
            <Text style={s.songName}>🎵 {lyric.song}</Text>
          </View>

          {streak >= 2 && (
            <Text style={s.streakBadge}>🔥 {streak} streak! </Text>
          )}

          <View style={s.lyricsBox}>
            {lyric.lines.map((line, lineIdx) => {
              const isBlank = lineIdx === lyric.blank;
              if (isBlank) {
                return (
                  <View key={lineIdx} style={s.blankLine}>
                    <Text style={s.lyricLine}>
                      {line.replace("___", "")}
                    </Text>
                    {revealed ? (
                      <Animated.View style={[s.answerBox, {
                        transform: [{ scale: feedbackAnim }],
                        backgroundColor: correct ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)",
                      }]}>
                        <Text style={[s.answerText, { color: correct ? "#4ade80" : "#f87171" }]}>
                          {lyric.answer} {correct ? "✓" : "✗"}
                        </Text>
                      </Animated.View>
                    ) : (
                      <View style={s.inputWrap}>
                        <Text style={s.blankIndicator}>[ ? ]</Text>
                      </View>
                    )}
                  </View>
                );
              }
              return <Text key={lineIdx} style={s.lyricLine}>{line}</Text>;
            })}
          </View>

          <View style={s.hintBox}>
            <Text style={s.hintText}>💡 Hint: {lyric.hint}</Text>
          </View>

          {!revealed && (
            <View style={s.inputSection}>
              <TextInput
                ref={inputRef}
                style={s.input}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Type the missing word…"
                placeholderTextColor="#444"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => checkAnswer(idx)}
              />
              <TouchableOpacity style={s.submitBtn} onPress={() => checkAnswer(idx)}>
                <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.submitBtnInner}>
                  <Text style={s.submitBtnText}>→</Text>
                </LinearGradient>
              </TouchableOpacity>
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

  timerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, gap: 10 },
  progress: { color: "#888", fontSize: 13, fontWeight: "700", width: 50 },
  timerTrack: { flex: 1, height: 6, backgroundColor: "#1e1e3a", borderRadius: 3, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 3 },
  timerNum: { fontSize: 15, fontWeight: "900", width: 28, textAlign: "right" },

  songBadge: { marginHorizontal: 20, backgroundColor: "rgba(167,139,250,0.12)", borderRadius: 10, padding: 10, marginBottom: 8 },
  songName: { color: "#a78bfa", fontSize: 13, fontWeight: "700", textAlign: "center" },

  streakBadge: { color: "#fbbf24", fontSize: 16, fontWeight: "900", textAlign: "center", marginBottom: 8 },

  lyricsBox: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  lyricLine: { color: "#ccc", fontSize: 22, fontWeight: "600", textAlign: "center", lineHeight: 30 },
  blankLine: { alignItems: "center", gap: 8 },
  blankIndicator: { color: "#b5179e", fontSize: 28, fontWeight: "900" },
  inputWrap: { alignItems: "center" },
  answerBox: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8 },
  answerText: { fontSize: 24, fontWeight: "900" },

  hintBox: { paddingHorizontal: 20, paddingBottom: 12 },
  hintText: { color: "#555", fontSize: 13, textAlign: "center" },

  inputSection: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 8 },
  input: { flex: 1, backgroundColor: "#1a1a3a", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 16 },
  submitBtn: { borderRadius: 14, overflow: "hidden" },
  submitBtnInner: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontSize: 20, fontWeight: "900" },

  scoreBar: { padding: 16, alignItems: "center" },
  scoreText: { color: "#a78bfa", fontSize: 15, fontWeight: "800" },

  bigScore: { color: "#b5179e", fontSize: 72, fontWeight: "900" },
  scoreLabel: { color: "#555", fontSize: 12, letterSpacing: 2, marginBottom: 12 },
  verdict: { color: "#a78bfa", fontSize: 18, fontWeight: "800", marginBottom: 32 },
});
