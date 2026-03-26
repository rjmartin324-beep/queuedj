import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { PostGameCard } from "../../components/shared/PostGameCard";

const ACCENT = "#f472b6";
const ALL_OPINIONS = [
  "Pineapple on pizza is actually good",
  "Die Hard is a Christmas movie",
  "Cats are better pets than dogs",
  "Breakfast is the most overrated meal",
  "The ocean is scarier than space",
  "Museums are boring",
  "Mornings are better than nights",
  "Tea is better than coffee",
  "Winter is the best season",
  "Camping is not actually fun",
  "Video games are a waste of time",
  "Working from home is worse than the office",
  "Social media has done more harm than good",
  "Books are overrated as entertainment",
  "Cold showers are better than hot ones",
  "Spicy food is overrated",
  "Flying is more enjoyable than road trips",
  "Introverts make better friends than extroverts",
  "Money can buy happiness",
  "Silence is better than small talk",
];

const TOTAL_ROUNDS = 10;

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type Phase = "welcome" | "playing" | "results";

export default function UnpopularOpinionsScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [opinions, setOpinions] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [agreeCount, setAgreeCount] = useState(0);
  const [lastVote, setLastVote] = useState<"agree" | "disagree" | null>(null);

  function startGame() {
    setOpinions(pickRandom(ALL_OPINIONS, TOTAL_ROUNDS));
    setRound(0);
    setAgreeCount(0);
    setLastVote(null);
    setPhase("playing");
  }

  function vote(choice: "agree" | "disagree") {
    if (lastVote !== null) return;
    const newAgree = choice === "agree" ? agreeCount + 1 : agreeCount;
    setLastVote(choice);
    setAgreeCount(newAgree);
    setTimeout(() => {
      const nextRound = round + 1;
      if (nextRound >= TOTAL_ROUNDS) {
        setAgreeCount(newAgree);
        setPhase("results");
      } else {
        setRound(nextRound);
        setLastVote(null);
      }
    }, 600);
  }

  function getTitle(agrees: number) {
    if (agrees < 5) return "Contrarian!";
    if (agrees < 8) return "Mainstream!";
    return "True Believer!";
  }

  if (phase === "welcome") {
    return (
      <LinearGradient colors={["#1a0015", "#08081a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={s.emoji}>🎤</Text>
            <Text style={s.title}>Unpopular Opinions</Text>
            <Text style={s.sub}>10 spicy takes — do you agree or disagree?</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• 10 controversial opinion cards</Text>
              <Text style={s.ruleItem}>• Tap Agree or Disagree</Text>
              <Text style={s.ruleItem}>• Find out if you're a contrarian or mainstream</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#be185d", "#f472b6"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>LET'S GO</Text>
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
        score={agreeCount}
        maxScore={10}
        gameEmoji="🎤"
        gameTitle="Unpopular Opinions"
        onPlayAgain={startGame}
      />
    );
  }

  const current = opinions[round];
  const progress = (round / TOTAL_ROUNDS) * 100;

  return (
    <LinearGradient colors={["#1a0015", "#08081a"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        {/* Progress bar */}
        <View style={s.progressContainer}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={s.progressLabel}>{round + 1} / {TOTAL_ROUNDS}</Text>
        </View>

        {/* Opinion card */}
        <View style={s.cardArea}>
          <View style={s.opinionCard}>
            <Text style={s.cardLabel}>UNPOPULAR OPINION</Text>
            <Text style={s.opinionText}>{current}</Text>
          </View>
        </View>

        {/* Vote buttons */}
        <View style={s.voteRow}>
          <TouchableOpacity
            style={[s.voteBtn, s.disagreeBtn, lastVote === "disagree" && s.votedBtnActive]}
            onPress={() => vote("disagree")}
            disabled={lastVote !== null}
            activeOpacity={0.8}
          >
            <Text style={s.voteEmoji}>👎</Text>
            <Text style={[s.voteBtnText, { color: "#f87171" }]}>DISAGREE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.voteBtn, s.agreeBtn, lastVote === "agree" && s.votedBtnActive]}
            onPress={() => vote("agree")}
            disabled={lastVote !== null}
            activeOpacity={0.8}
          >
            <Text style={s.voteEmoji}>👍</Text>
            <Text style={[s.voteBtnText, { color: "#4ade80" }]}>AGREE</Text>
          </TouchableOpacity>
        </View>

        {lastVote && (
          <Text style={s.votedHint}>
            {lastVote === "agree" ? "Noted! Moving on..." : "Noted! Moving on..."}
          </Text>
        )}
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

  progressContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  progressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  progressLabel: { color: "#888", fontSize: 12, fontWeight: "700", textAlign: "right" },

  cardArea: { flex: 1, paddingHorizontal: 20, justifyContent: "center" },
  opinionCard: {
    backgroundColor: "rgba(244,114,182,0.08)",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.25)",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
  },
  cardLabel: { color: ACCENT, fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 20 },
  opinionText: { color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center", lineHeight: 32 },

  voteRow: { flexDirection: "row", paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  voteBtn: {
    flex: 1,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 2,
  },
  disagreeBtn: { backgroundColor: "rgba(248,113,113,0.1)", borderColor: "rgba(248,113,113,0.3)" },
  agreeBtn: { backgroundColor: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.3)" },
  votedBtnActive: { opacity: 0.5 },
  voteEmoji: { fontSize: 28, marginBottom: 6 },
  voteBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  votedHint: { color: "#555", fontSize: 13, textAlign: "center", paddingBottom: 12 },

  resultsScore: { color: ACCENT, fontSize: 28, fontWeight: "900", marginTop: 8, marginBottom: 12 },
  resultsDetail: { color: "#888", fontSize: 15, textAlign: "center", marginBottom: 32, paddingHorizontal: 16 },
});
