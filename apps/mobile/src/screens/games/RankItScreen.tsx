import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const CHALLENGES = [
  {
    title: "Best pizza toppings",
    items: ["Pepperoni", "Mushrooms", "Extra Cheese", "Jalapeños", "Pineapple"],
  },
  {
    title: "Best 90s cartoons",
    items: ["SpongeBob", "Rugrats", "Hey Arnold!", "Dexter's Lab", "Powerpuff Girls"],
  },
  {
    title: "Best ice cream flavors",
    items: ["Chocolate", "Vanilla", "Strawberry", "Mint Choc Chip", "Cookie Dough"],
  },
  {
    title: "Worst chores to do",
    items: ["Dishes", "Laundry", "Vacuuming", "Cleaning Bathrooms", "Taking Out Trash"],
  },
  {
    title: "Best movie genres",
    items: ["Action", "Comedy", "Horror", "Romance", "Sci-Fi"],
  },
];

type Phase = "lobby" | "playing" | "reveal" | "results";

export default function RankItScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [ranking, setRanking] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [groupRanking, setGroupRanking] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [localRanking, setLocalRanking] = React.useState<string[]>([]);
  const [submitted, setSubmitted] = React.useState(false);

  // Reset local ranking when challenge changes (mp mode)
  React.useEffect(() => {
    if (inRoom && mpState?.currentChallenge?.items?.length) {
      setLocalRanking([...mpState.currentChallenge.items]);
      setSubmitted(false);
    }
  }, [JSON.stringify(inRoom && mpState ? mpState.currentChallenge?.items : null)]);

  function startGame() {
    setPhase("playing");
    setChallengeIdx(0);
    setScore(0);
    setRoundScores([]);
    const challenge = CHALLENGES[0];
    setRanking([...challenge.items]);
    animateIn();
  }

  function animateIn() {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }

  function moveItem(from: number, to: number) {
    const newRanking = [...ranking];
    const item = newRanking.splice(from, 1)[0];
    newRanking.splice(to, 0, item);
    setRanking(newRanking);
  }

  function lockIn() {
    // Generate a simulated "group" ranking slightly different from user's
    const shuffled = [...ranking];
    if (shuffled.length > 2) {
      const i = Math.floor(Math.random() * (shuffled.length - 1));
      [shuffled[i], shuffled[i + 1]] = [shuffled[i + 1], shuffled[i]];
    }
    setGroupRanking(shuffled);

    // Score based on similarity to group
    let pts = 0;
    ranking.forEach((item, idx) => {
      const groupIdx = shuffled.indexOf(item);
      const diff = Math.abs(idx - groupIdx);
      pts += [300, 200, 100, 0, 0][diff] ?? 0;
    });
    setScore((s) => s + pts);
    setRoundScores((rs) => [...rs, pts]);
    setPhase("reveal");
  }

  function nextChallenge() {
    if (challengeIdx + 1 >= CHALLENGES.length) {
      setPhase("results");
      return;
    }
    const nextIdx = challengeIdx + 1;
    setChallengeIdx(nextIdx);
    setRanking([...CHALLENGES[nextIdx].items]);
    setPhase("playing");
    animateIn();
  }

  // ─── Multiplayer block ────────────────────────────────────────────────────
  if (inRoom && mpState) {
    const mpPhase: string = mpState.phase ?? "waiting";
    const round: number = mpState.round ?? 1;
    const currentChallenge: { items: string[] } = mpState.currentChallenge ?? { items: [] };
    const rankings: Record<string, string[]> = mpState.rankings ?? {};
    const scores: Record<string, number> = mpState.scores ?? {};
    const myGuestId = state.guestId ?? "";

    function mpMoveItem(from: number, to: number) {
      const next = [...localRanking];
      const item = next.splice(from, 1)[0];
      next.splice(to, 0, item);
      setLocalRanking(next);
    }

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#001a20"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 72, marginBottom: 16 }}>📊</Text>
              <Text style={s.title}>Rank It</Text>
              <Text style={s.sub}>Waiting for the host to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "finished") {
      const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
      return (
        <LinearGradient colors={["#03001c", "#001a20"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={s.resultsScroll}>
              <Text style={{ fontSize: 64, textAlign: "center" }}>🏆</Text>
              <Text style={s.resultsTitle}>Final Scores</Text>
              {sortedScores.map(([id, pts], i) => (
                <View key={id} style={s.roundScoreRow}>
                  <Text style={[s.roundScoreLabel, { color: id === myGuestId ? "#b5179e" : "#ccc" }]}>
                    {i + 1}. {id === myGuestId ? "You" : id}
                  </Text>
                  <Text style={s.roundScoreVal}>{pts} pts</Text>
                </View>
              ))}
              <TouchableOpacity style={s.startBtn} onPress={() => router.back()}>
                <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                  <Text style={s.startBtnText}>BACK TO HOME</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const myRanking = rankings[myGuestId] ?? localRanking;
      const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
      // Compute correct order from majority votes or use first available ranking
      const otherRankings = Object.values(rankings);
      const correctOrder = otherRankings[0] ?? currentChallenge.items;
      return (
        <LinearGradient colors={["#03001c", "#001a20"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}>
              <Text style={s.progress}>Round {round}</Text>
              <Text style={s.scoreChip}>Score: {scores[myGuestId] ?? 0}</Text>
            </View>
            <View style={s.compareSection}>
              <View style={s.compareCol}>
                <Text style={s.compareColHead}>YOUR RANKING</Text>
                {myRanking.map((item, i) => (
                  <View key={item} style={s.revealRow}>
                    <Text style={s.revealRank}>{i + 1}</Text>
                    <Text style={s.revealItem}>{item}</Text>
                  </View>
                ))}
              </View>
              <View style={s.compareCol}>
                <Text style={s.compareColHead}>GROUP RANKING</Text>
                {correctOrder.map((item, i) => (
                  <View key={item} style={[s.revealRow, { backgroundColor: correctOrder[i] === myRanking[i] ? "rgba(22,163,74,0.2)" : "transparent" }]}>
                    <Text style={s.revealRank}>{i + 1}</Text>
                    <Text style={s.revealItem}>{item}</Text>
                    {correctOrder[i] === myRanking[i] && <Text style={{ color: "#16a34a" }}>✓</Text>}
                  </View>
                ))}
              </View>
            </View>
            <View style={{ padding: 20, paddingTop: 8 }}>
              {sortedScores.map(([id, pts], i) => (
                <Text key={id} style={{ color: id === myGuestId ? "#b5179e" : "#888", fontSize: 13, marginBottom: 2 }}>
                  {i + 1}. {id === myGuestId ? "You" : id}: {pts} pts
                </Text>
              ))}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    // ranking phase
    return (
      <LinearGradient colors={["#03001c", "#001a20"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.progress}>Round {round}</Text>
            <Text style={s.scoreChip}>Score: {scores[myGuestId] ?? 0}</Text>
          </View>
          {submitted ? (
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
              <Text style={{ color: "#a78bfa", fontSize: 18, fontWeight: "800" }}>Waiting for others…</Text>
              <Text style={{ color: "#555", fontSize: 13, marginTop: 8 }}>{Object.keys(rankings).length} submitted</Text>
            </View>
          ) : (
            <>
              <Text style={s.challengeTitle}>{mpState.currentChallenge?.title ?? "Rank these items"}</Text>
              <Text style={s.hint}>Use ↑ ↓ to reorder • #1 = Best</Text>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                {localRanking.map((item, idx) => (
                  <View key={item} style={s.rankRow}>
                    <LinearGradient colors={["#1a1a3a", "#2a1a4a"]} style={s.rankCard}>
                      <Text style={s.rankNum}>{idx + 1}</Text>
                      <Text style={s.rankItem}>{item}</Text>
                      <View style={s.rankControls}>
                        <TouchableOpacity
                          onPress={() => idx > 0 && mpMoveItem(idx, idx - 1)}
                          disabled={idx === 0}
                          style={[s.rankBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
                        >
                          <Text style={s.rankBtnText}>↑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => idx < localRanking.length - 1 && mpMoveItem(idx, idx + 1)}
                          disabled={idx === localRanking.length - 1}
                          style={[s.rankBtn, { opacity: idx === localRanking.length - 1 ? 0.3 : 1 }]}
                        >
                          <Text style={s.rankBtnText}>↓</Text>
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </View>
                ))}
              </ScrollView>
              <View style={{ padding: 20 }}>
                <TouchableOpacity
                  style={s.startBtn}
                  onPress={() => {
                    sendAction("submit_ranking", { order: localRanking });
                    setSubmitted(true);
                  }}
                >
                  <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                    <Text style={s.startBtnText}>LOCK IN MY RANKING →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }
  // ─── End multiplayer block ────────────────────────────────────────────────

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#001a20"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>📊</Text>
            <Text style={s.title}>Rank It</Text>
            <Text style={s.sub}>Order these lists your way — then see if your ranking matches the group</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• Use ↑ ↓ arrows to reorder items</Text>
              <Text style={s.ruleItem}>• +300 pts per item that exactly matches group</Text>
              <Text style={s.ruleItem}>• +200 pts for one spot off</Text>
              <Text style={s.ruleItem}>• {CHALLENGES.length} lists to rank</Text>
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
    const maxScore = CHALLENGES.length * ranking.length * 300;
    const pct = Math.round((score / maxScore) * 100);
    return (
      <LinearGradient colors={["#03001c", "#001a20"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <ScrollView contentContainerStyle={s.resultsScroll}>
            <Text style={{ fontSize: 64, textAlign: "center" }}>🏆</Text>
            <Text style={s.resultsTitle}>Final Score</Text>
            <Text style={s.bigScore}>{score}</Text>
            <Text style={s.scoreLabel}>{pct}% alignment with group</Text>
            <Text style={s.verdict}>
              {pct >= 80 ? "🧠 Group Mind Reader!" : pct >= 60 ? "👍 Pretty Aligned" : pct >= 40 ? "🤷 Unique Taste" : "🌪️ Chaotic Ranker"}
            </Text>
            {roundScores.map((rs, i) => (
              <View key={i} style={s.roundScoreRow}>
                <Text style={s.roundScoreLabel}>{CHALLENGES[i].title}</Text>
                <Text style={s.roundScoreVal}>{rs} pts</Text>
              </View>
            ))}
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>PLAY AGAIN</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}>
              <Text style={s.homeBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const challenge = CHALLENGES[challengeIdx];

  if (phase === "reveal") {
    return (
      <LinearGradient colors={["#03001c", "#001a20"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.progress}>{challengeIdx + 1}/{CHALLENGES.length}</Text>
            <Text style={s.scoreChip}>+{roundScores[roundScores.length - 1]} pts</Text>
          </View>
          <Text style={s.revealTitle}>"{challenge.title}"</Text>
          <View style={s.compareSection}>
            <View style={s.compareCol}>
              <Text style={s.compareColHead}>YOUR RANKING</Text>
              {ranking.map((item, i) => (
                <View key={item} style={s.revealRow}>
                  <Text style={s.revealRank}>{i + 1}</Text>
                  <Text style={s.revealItem}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={s.compareCol}>
              <Text style={s.compareColHead}>GROUP RANKING</Text>
              {groupRanking.map((item, i) => (
                <View key={item} style={[s.revealRow, { backgroundColor: groupRanking[i] === ranking[i] ? "rgba(22,163,74,0.2)" : "transparent" }]}>
                  <Text style={s.revealRank}>{i + 1}</Text>
                  <Text style={s.revealItem}>{item}</Text>
                  {groupRanking[i] === ranking[i] && <Text style={{ color: "#16a34a" }}>✓</Text>}
                </View>
              ))}
            </View>
          </View>
          <View style={{ padding: 20 }}>
            <TouchableOpacity style={s.startBtn} onPress={nextChallenge}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>{challengeIdx + 1 >= CHALLENGES.length ? "See Results" : "Next List →"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Playing
  return (
    <LinearGradient colors={["#03001c", "#001a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.progress}>{challengeIdx + 1}/{CHALLENGES.length}</Text>
          <Text style={s.scoreChip}>Score: {score}</Text>
        </View>
        <Animated.View style={[{ flex: 1, opacity: fadeAnim }]}>
          <Text style={s.challengeTitle}>{challenge.title}</Text>
          <Text style={s.hint}>Drag to reorder • #1 = Best</Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            {ranking.map((item, idx) => (
              <View key={item} style={s.rankRow}>
                <LinearGradient colors={["#1a1a3a", "#2a1a4a"]} style={s.rankCard}>
                  <Text style={s.rankNum}>{idx + 1}</Text>
                  <Text style={s.rankItem}>{item}</Text>
                  <View style={s.rankControls}>
                    <TouchableOpacity
                      onPress={() => idx > 0 && moveItem(idx, idx - 1)}
                      disabled={idx === 0}
                      style={[s.rankBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
                    >
                      <Text style={s.rankBtnText}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => idx < ranking.length - 1 && moveItem(idx, idx + 1)}
                      disabled={idx === ranking.length - 1}
                      style={[s.rankBtn, { opacity: idx === ranking.length - 1 ? 0.3 : 1 }]}
                    >
                      <Text style={s.rankBtnText}>↓</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
        <View style={{ padding: 20 }}>
          <TouchableOpacity style={s.startBtn} onPress={lockIn}>
            <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
              <Text style={s.startBtnText}>LOCK IN MY RANKING →</Text>
            </LinearGradient>
          </TouchableOpacity>
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
  title: { color: "#fff", fontSize: 32, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub: { color: "#888", fontSize: 13, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12, alignItems: "center" },
  homeBtnText: { color: "#666", fontSize: 15 },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  progress: { color: "#888", fontWeight: "700", fontSize: 14 },
  scoreChip: { color: "#a78bfa", fontWeight: "800", fontSize: 14 },
  challengeTitle: { color: "#fff", fontSize: 20, fontWeight: "900", paddingHorizontal: 20, marginBottom: 4 },
  hint: { color: "#555", fontSize: 12, paddingHorizontal: 20, marginBottom: 16 },
  rankRow: { marginBottom: 10 },
  rankCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, gap: 12 },
  rankNum: { color: "#b5179e", fontSize: 18, fontWeight: "900", width: 28 },
  rankItem: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 },
  rankControls: { flexDirection: "row", gap: 6 },
  rankBtn: { width: 32, height: 32, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rankBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  revealTitle: { color: "#fff", fontSize: 20, fontWeight: "900", paddingHorizontal: 20, paddingBottom: 12 },
  compareSection: { flex: 1, flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  compareCol: { flex: 1 },
  compareColHead: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 10, textAlign: "center" },
  revealRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 6, backgroundColor: "rgba(255,255,255,0.05)" },
  revealRank: { color: "#b5179e", fontSize: 14, fontWeight: "900", width: 20 },
  revealItem: { color: "#ccc", fontSize: 12, flex: 1 },

  resultsScroll: { padding: 24, alignItems: "center" },
  resultsTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 12 },
  bigScore: { color: "#b5179e", fontSize: 72, fontWeight: "900" },
  scoreLabel: { color: "#888", fontSize: 14, marginBottom: 8 },
  verdict: { color: "#a78bfa", fontSize: 16, fontWeight: "700", marginBottom: 24 },
  roundScoreRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1e1e3a" },
  roundScoreLabel: { color: "#ccc", fontSize: 13 },
  roundScoreVal: { color: "#b5179e", fontWeight: "800", fontSize: 13 },
});
