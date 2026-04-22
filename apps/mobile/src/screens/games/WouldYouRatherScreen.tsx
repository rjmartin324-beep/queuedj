import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const PROMPTS = [
  { a: "Always have to speak in rhymes", b: "Never be able to use emojis again" },
  { a: "Be able to fly but only 1 mph", b: "Be able to read minds but only hear grocery lists" },
  { a: "Eat the same meal every day forever", b: "Never eat your favorite food again" },
  { a: "Have 10 minutes of fame in 100 years", b: "Be slightly famous right now" },
  { a: "Know the day you die", b: "Know how you die" },
  { a: "Fight 100 duck-sized horses", b: "Fight 1 horse-sized duck" },
  { a: "Live in VR forever", b: "Never use a screen again" },
  { a: "Have no thumbs", b: "Have no elbows" },
  { a: "Be always 10 minutes late", b: "Be always 20 minutes early" },
  { a: "Lose all your memories from age 0–15", b: "Lose all your memories from the last 5 years" },
];

type Phase = "lobby" | "voting" | "reveal" | "results";

export default function WouldYouRatherScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [votesA, setVotesA] = useState(0);
  const [votesB, setVotesB] = useState(0);
  const [myVote, setMyVote] = useState<"a" | "b" | null>(null);
  const slideA = useRef(new Animated.Value(0)).current;
  const slideB = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  function startGame() {
    setPhase("voting");
    setRound(0);
    setScore(0);
    animateIn();
  }

  function animateIn() {
    fadeIn.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }

  function vote(side: "a" | "b") {
    if (myVote) return;
    setMyVote(side);
    // Simulate other players
    const totalSimulated = Math.floor(Math.random() * 8) + 3;
    const aVotes = side === "a"
      ? Math.ceil(totalSimulated * (0.4 + Math.random() * 0.4))
      : Math.floor(totalSimulated * Math.random() * 0.4);
    const bVotes = totalSimulated - aVotes;
    setVotesA(aVotes);
    setVotesB(bVotes);

    setTimeout(() => {
      setPhase("reveal");
      const aTotal = aVotes;
      const bTotal = bVotes;
      const total = aTotal + bTotal;
      Animated.parallel([
        Animated.timing(slideA, { toValue: total > 0 ? aTotal / total : 0.5, duration: 800, useNativeDriver: false }),
        Animated.timing(slideB, { toValue: total > 0 ? bTotal / total : 0.5, duration: 800, useNativeDriver: false }),
      ]).start();
      // Points for siding with majority
      const majorityA = aTotal >= bTotal;
      if ((side === "a" && majorityA) || (side === "b" && !majorityA)) {
        setScore((s) => s + 200);
      } else {
        setScore((s) => s + 50); // minority opinion bonus
      }
    }, 500);
  }

  function nextRound() {
    if (round + 1 >= PROMPTS.length) {
      setPhase("results");
      return;
    }
    setMyVote(null);
    setVotesA(0);
    setVotesB(0);
    slideA.setValue(0);
    slideB.setValue(0);
    setRound((r) => r + 1);
    setPhase("voting");
    animateIn();
  }

  // ── Multiplayer block ──────────────────────────────────────────────────────
  // Guard: in-room but experience state hasn't arrived yet — show loading
  // instead of falling through to standalone lobby where vote() never calls
  // sendAction and votes are silently lost.
  if (inRoom && !mpState) {
    return (
      <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
            <Text style={s.gameTitle}>Loading game…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (inRoom && mpState) {
    const mpPhase: string = mpState.phase ?? "waiting";
    const myGuestId = state.guestId;
    const myVoteMp: "a" | "b" | null = mpState.votes?.[myGuestId ?? ""] ?? null;

    const sortedScores: [string, number][] = Object.entries(mpState.scores ?? {}).sort(
      (a, b) => (b[1] as number) - (a[1] as number)
    );

    function getMemberName(guestId: string) {
      const member = state.members.find((m) => m.guestId === guestId);
      return member?.displayName ?? guestId;
    }

    if (mpPhase === "finished") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={s.center}>
              <Text style={{ fontSize: 56, textAlign: "center", marginBottom: 12 }}>🗳️</Text>
              <Text style={s.gameTitle}>Final Leaderboard</Text>
              {sortedScores.map(([gid, pts], i) => (
                <View key={gid} style={[s.lbRow, gid === myGuestId && s.lbRowMe]}>
                  <Text style={s.lbRank}>#{i + 1}</Text>
                  <Text style={s.lbName}>{getMemberName(gid)}{gid === myGuestId ? " (you)" : ""}</Text>
                  <Text style={s.lbPts}>{pts as number} pts</Text>
                </View>
              ))}
              <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}>
                <Text style={s.homeBtnText}>Back to Home</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
              <Text style={s.gameTitle}>Waiting for game to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "question") {
      const q = mpState.currentQ ?? { a: "", b: "" };
      const voted = !!myVoteMp;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}>
              <Text style={s.roundPill}>Round {mpState.round ?? "?"} / {mpState.totalRounds ?? "?"}</Text>
            </View>
            <View style={[s.cardContainer, { justifyContent: "center" }]}>
              <Text style={s.wyr}>WOULD YOU RATHER…</Text>

              <TouchableOpacity
                onPress={() => { if (!voted) sendAction("vote", { choice: "a" }); }}
                disabled={voted}
                activeOpacity={0.85}
                style={[s.optCard, myVoteMp === "a" && s.selectedA]}
              >
                <LinearGradient
                  colors={myVoteMp === "a" ? ["#7209b7", "#b5179e"] : ["#1a1a3a", "#2a1a4a"]}
                  style={s.optInner}
                >
                  <Text style={s.optLabel}>A</Text>
                  <Text style={s.optText}>{q.a}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={s.orBadge}><Text style={s.orText}>OR</Text></View>

              <TouchableOpacity
                onPress={() => { if (!voted) sendAction("vote", { choice: "b" }); }}
                disabled={voted}
                activeOpacity={0.85}
                style={[s.optCard, myVoteMp === "b" && s.selectedB]}
              >
                <LinearGradient
                  colors={myVoteMp === "b" ? ["#0a4fa3", "#1e40af"] : ["#1a1a3a", "#2a1a4a"]}
                  style={s.optInner}
                >
                  <Text style={s.optLabel}>B</Text>
                  <Text style={s.optText}>{q.b}</Text>
                </LinearGradient>
              </TouchableOpacity>

              {voted && <Text style={s.hint}>Waiting for others…</Text>}
              {!voted && <Text style={s.hint}>Tap to vote</Text>}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const aCount: number = mpState.aCount ?? 0;
      const bCount: number = mpState.bCount ?? 0;
      const total = aCount + bCount || 1;
      const aFlex = aCount / total;
      const bFlex = bCount / total;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}>
              <Text style={s.roundPill}>Round {mpState.round ?? "?"} / {mpState.totalRounds ?? "?"}</Text>
            </View>
            <View style={[s.cardContainer, { justifyContent: "center" }]}>
              <Text style={s.wyr}>RESULTS</Text>
              <View style={s.resultZone}>
                <Text style={s.resultTitle}>Group voted…</Text>
                <View style={s.barRow}>
                  <View style={[s.barA, { flex: Math.max(aFlex, 0.01) }]}>
                    <Text style={s.barLabel}>{aCount} 👤 A</Text>
                  </View>
                  <View style={[s.barB, { flex: Math.max(bFlex, 0.01) }]}>
                    <Text style={s.barLabel}>B {bCount} 👤</Text>
                  </View>
                </View>
                {myVoteMp && (
                  <Text style={{ color: "#a78bfa", textAlign: "center", marginBottom: 8 }}>
                    You voted: {myVoteMp.toUpperCase()}
                  </Text>
                )}
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                {sortedScores.map(([gid, pts], i) => (
                  <View key={gid} style={[s.lbRow, gid === myGuestId && s.lbRowMe]}>
                    <Text style={s.lbRank}>#{i + 1}</Text>
                    <Text style={s.lbName}>{getMemberName(gid)}</Text>
                    <Text style={s.lbPts}>{pts as number} pts</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ color: "#888", fontSize: 16 }}>Phase: {mpPhase}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }
  // ── End multiplayer block ──────────────────────────────────────────────────

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>🤔</Text>
            <Text style={s.gameTitle}>Would You Rather</Text>
            <Text style={s.gameSub}>Pick a side · see what your crew chose · earn points for siding with the majority</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• 10 dilemmas to vote on</Text>
              <Text style={s.ruleItem}>• +200 pts for majority opinion</Text>
              <Text style={s.ruleItem}>• +50 pts for a bold minority take</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>PLAY</Text>
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
        gameEmoji="🤔"
        gameTitle="Would You Rather"
        onPlayAgain={startGame}
      />
    );
  }

  const p = PROMPTS[round];

  return (
    <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.roundPill}>{round + 1} / {PROMPTS.length}</Text>
          <Text style={s.scoreChip}>Score: {score}</Text>
        </View>

        <Animated.View style={[s.cardContainer, { opacity: fadeIn }]}>
          <Text style={s.wyr}>WOULD YOU RATHER…</Text>

          {/* Option A */}
          <TouchableOpacity
            onPress={() => vote("a")}
            disabled={!!myVote}
            activeOpacity={0.85}
            style={[s.optCard, myVote === "a" && s.selectedA]}
          >
            <LinearGradient
              colors={myVote === "a" ? ["#7209b7", "#b5179e"] : ["#1a1a3a", "#2a1a4a"]}
              style={s.optInner}
            >
              <Text style={s.optLabel}>A</Text>
              <Text style={s.optText}>{p.a}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.orBadge}><Text style={s.orText}>OR</Text></View>

          {/* Option B */}
          <TouchableOpacity
            onPress={() => vote("b")}
            disabled={!!myVote}
            activeOpacity={0.85}
            style={[s.optCard, myVote === "b" && s.selectedB]}
          >
            <LinearGradient
              colors={myVote === "b" ? ["#0a4fa3", "#1e40af"] : ["#1a1a3a", "#2a1a4a"]}
              style={s.optInner}
            >
              <Text style={s.optLabel}>B</Text>
              <Text style={s.optText}>{p.b}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {phase === "reveal" && (
          <View style={s.resultZone}>
            <Text style={s.resultTitle}>Group voted…</Text>
            <View style={s.barRow}>
              <Animated.View style={[s.barA, {
                flex: slideA.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] }),
              }]}>
                <Text style={s.barLabel}>{votesA} 👤</Text>
              </Animated.View>
              <Animated.View style={[s.barB, {
                flex: slideB.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] }),
              }]}>
                <Text style={s.barLabel}>{votesB} 👤</Text>
              </Animated.View>
            </View>
            <TouchableOpacity style={s.nextBtn} onPress={nextRound}>
              <Text style={s.nextBtnText}>
                {round + 1 >= PROMPTS.length ? "See Results" : "Next →"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === "voting" && !myVote && (
          <Text style={s.hint}>Tap to vote</Text>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  back: { padding: 16, paddingTop: 8 },
  backText: { color: "#a78bfa", fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  gameTitle: { color: "#fff", fontSize: 32, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  gameSub: { color: "#888", fontSize: 13, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12 },
  homeBtnText: { color: "#666", fontSize: 15 },
  bigScore: { color: "#b5179e", fontSize: 72, fontWeight: "900" },
  scoreLabel: { color: "#555", fontSize: 12, letterSpacing: 2, marginBottom: 24 },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  roundPill: { color: "#888", fontWeight: "700", fontSize: 13 },
  scoreChip: { color: "#a78bfa", fontWeight: "800", fontSize: 14 },

  cardContainer: { flex: 1, paddingHorizontal: 16, justifyContent: "center" },
  wyr: { color: "#555", fontSize: 11, fontWeight: "900", letterSpacing: 2, textAlign: "center", marginBottom: 16 },
  optCard: { borderRadius: 18, overflow: "hidden", marginBottom: 0 },
  selectedA: { shadowColor: "#b5179e", shadowRadius: 12, shadowOpacity: 0.6, elevation: 8 },
  selectedB: { shadowColor: "#3b82f6", shadowRadius: 12, shadowOpacity: 0.6, elevation: 8 },
  optInner: { padding: 24, minHeight: 110, justifyContent: "center" },
  optLabel: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "900", marginBottom: 8 },
  optText: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 24 },

  orBadge: { alignItems: "center", paddingVertical: 10 },
  orText: { color: "#b5179e", fontSize: 16, fontWeight: "900", backgroundColor: "rgba(181,23,158,0.12)", paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20 },

  resultZone: { paddingHorizontal: 20, paddingBottom: 32 },
  resultTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  barRow: { flexDirection: "row", height: 48, borderRadius: 12, overflow: "hidden", marginBottom: 16, gap: 2 },
  barA: { backgroundColor: "#7209b7", alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 8 },
  barB: { backgroundColor: "#1e40af", alignItems: "flex-start", justifyContent: "center", paddingHorizontal: 8 },
  barLabel: { color: "#fff", fontSize: 13, fontWeight: "800" },
  nextBtn: { backgroundColor: "rgba(167,139,250,0.15)", borderRadius: 14, padding: 14, alignItems: "center" },
  nextBtnText: { color: "#a78bfa", fontSize: 16, fontWeight: "800" },

  hint: { color: "#444", fontSize: 14, textAlign: "center", paddingBottom: 16 },

  // Multiplayer leaderboard
  lbRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 12, marginBottom: 6, width: "100%" },
  lbRowMe: { backgroundColor: "rgba(181,23,158,0.18)", borderWidth: 1, borderColor: "#b5179e" },
  lbRank: { color: "#555", fontSize: 13, fontWeight: "900", width: 28 },
  lbName: { color: "#fff", fontSize: 14, fontWeight: "700", flex: 1 },
  lbPts: { color: "#a78bfa", fontSize: 14, fontWeight: "900" },
});
