import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const TRUTHS = [
  "What's the most embarrassing thing you've ever done?",
  "Have you ever lied to get out of trouble? What was it?",
  "What's your most irrational fear?",
  "What's the worst gift you've ever received?",
  "What's a secret you've never told anyone here?",
  "What's the most childish thing you still do?",
  "Have you ever cheated on a test or game?",
  "What's the last thing you Googled?",
  "Who in this group would you swap lives with?",
  "What's your biggest pet peeve?",
  "What's a lie you told recently?",
  "What's the most embarrassing song on your playlist?",
];

const DARES = [
  "Do your best celebrity impression for 30 seconds",
  "Send a voice note saying 'I love you' to the last person you texted",
  "Do 10 push-ups right now",
  "Let the group send one text from your phone",
  "Speak in a foreign accent for the next 2 rounds",
  "Call someone and sing Happy Birthday to them",
  "Do the worm dance move",
  "Let someone post on your social media",
  "Talk in a whisper for the next 3 rounds",
  "Hold a plank for 45 seconds",
  "Send the most unflattering photo of yourself to the group",
  "Do your best catwalk across the room",
];

type Phase = "lobby" | "spin" | "playing" | "results";
type Choice = "truth" | "dare";

export default function TruthOrDareScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [round, setRound] = useState(0);
  const [passed, setPassed] = useState(0);
  const [completed, setCompleted] = useState(0);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const MAX_ROUNDS = 12;

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <View style={{alignItems:"center",padding:24}}>
                <Text style={{fontSize:48}}>🏆</Text>
                <Text style={{color:"#fff",fontSize:24,fontWeight:"900",marginBottom:20}}>Final Scores</Text>
                {Object.entries(mp.scores||{}).sort(([,a],[,b])=>(b as number)-(a as number)).map(([gId,pts],i)=>(
                  <View key={gId} style={{flexDirection:"row",justifyContent:"space-between",width:"100%",marginBottom:8}}>
                    <Text style={{color:"#ccc",fontSize:16}}>{i+1}. {memberName(gId)}</Text>
                    <Text style={{color:"#a78bfa",fontSize:16,fontWeight:"700"}}>{pts as number} pts</Text>
                  </View>
                ))}
                <TouchableOpacity onPress={()=>router.back()} style={{marginTop:24,padding:12}}>
                  <Text style={{color:"#666"}}>← Back</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "spinning") {
      return (
        <LinearGradient colors={["#03001c","#300010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 72, marginBottom: 16 }}>🎭</Text>
              <Text style={{ color: "#888", fontSize: 20, fontWeight: "700" }}>Spinning…</Text>
              <Text style={{ color: "#555", fontSize: 14, marginTop: 8 }}>Waiting for next challenge</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "playing") {
      const isMyTurn = myGuestId === mp.currentPlayer;
      const challengeType = mp.challengeType ?? "truth";
      return (
        <LinearGradient colors={["#03001c","#300010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}>
              <Text style={s.roundText}>Round {mp.round ?? 1}</Text>
              <View style={[s.choicePill, { backgroundColor: challengeType === "truth" ? "#1d4ed8" : "#dc2626" }]}>
                <Text style={s.choicePillText}>{challengeType === "truth" ? "TRUTH" : "DARE"}</Text>
              </View>
            </View>
            <View style={s.promptSection}>
              <LinearGradient
                colors={challengeType === "truth" ? ["#1e3a8a","#1d4ed8"] : ["#7f1d1d","#991b1b"]}
                style={s.promptCard}
              >
                <Text style={s.promptEmoji}>{challengeType === "truth" ? "💬" : "🔥"}</Text>
                <Text style={s.promptText}>{mp.challenge}</Text>
              </LinearGradient>
            </View>
            {isMyTurn ? (
              <View style={s.actionRow}>
                <TouchableOpacity onPress={() => sendAction("complete", {})} style={s.doneBtn} activeOpacity={0.85}>
                  <LinearGradient colors={["#166534","#16a34a"]} style={s.actionBtnInner}>
                    <Text style={s.actionBtnText}>✓ Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => sendAction("pass", {})} style={s.passBtn} activeOpacity={0.85}>
                  <LinearGradient colors={["#374151","#4b5563"]} style={s.actionBtnInner}>
                    <Text style={s.actionBtnText}>Pass</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={{ color: "#888", fontSize: 16, fontWeight: "700" }}>
                  ⏳ Waiting for {memberName(mp.currentPlayer)}…
                </Text>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      );
    }
  }

  function startGame() {
    setPhase("spin");
    setRound(0);
    setPassed(0);
    setCompleted(0);
    setChoice(null);
    setCurrentPrompt("");
  }

  function pickTruth() {
    setChoice("truth");
    const prompt = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
    setCurrentPrompt(prompt);
    revealPrompt();
  }

  function pickDare() {
    setChoice("dare");
    const prompt = DARES[Math.floor(Math.random() * DARES.length)];
    setCurrentPrompt(prompt);
    revealPrompt();
  }

  function revealPrompt() {
    setPhase("playing");
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14 }),
    ]).start();
  }

  function handleDone() {
    setCompleted((c) => c + 1);
    advance();
  }

  function handlePass() {
    setPassed((p) => p + 1);
    advance();
  }

  function advance() {
    if (round + 1 >= MAX_ROUNDS) {
      setPhase("results");
    } else {
      setRound((r) => r + 1);
      setPhase("spin");
      setChoice(null);
    }
  }

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#300010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>🎭</Text>
            <Text style={s.title}>Truth or Dare</Text>
            <Text style={s.sub}>The classic — no rules, just guts</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• Choose Truth or Dare each round</Text>
              <Text style={s.ruleItem}>• {MAX_ROUNDS} rounds total per session</Text>
              <Text style={s.ruleItem}>• You can pass once per game</Text>
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
      <LinearGradient colors={["#03001c", "#300010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>🏆</Text>
            <Text style={s.title}>Session Over!</Text>
            <View style={s.statsGrid}>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: "#b5179e" }]}>{completed}</Text>
                <Text style={s.statLabel}>Completed</Text>
              </View>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: "#fbbf24" }]}>{passed}</Text>
                <Text style={s.statLabel}>Passed</Text>
              </View>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: "#a78bfa" }]}>{MAX_ROUNDS}</Text>
                <Text style={s.statLabel}>Rounds</Text>
              </View>
            </View>
            <Text style={s.bravery}>
              Bravery score: {Math.round((completed / MAX_ROUNDS) * 100)}%{" "}
              {completed / MAX_ROUNDS > 0.8 ? "🦁 Legend" : completed / MAX_ROUNDS > 0.5 ? "😤 Solid" : "🐔 Chicken"}
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

  if (phase === "spin") {
    return (
      <LinearGradient colors={["#03001c", "#300010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.roundText}>Round {round + 1}/{MAX_ROUNDS}</Text>
          </View>
          <View style={s.center}>
            <Text style={s.choicePrompt}>Pick your fate…</Text>
            <View style={s.choiceCards}>
              <TouchableOpacity onPress={pickTruth} activeOpacity={0.85} style={s.truthCardWrap}>
                <LinearGradient colors={["#1d4ed8", "#3b82f6"]} style={s.choiceCard}>
                  <Text style={s.choiceCardEmoji}>💬</Text>
                  <Text style={s.choiceCardTitle}>TRUTH</Text>
                  <Text style={s.choiceCardSub}>Bare your soul</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickDare} activeOpacity={0.85} style={s.dareCardWrap}>
                <LinearGradient colors={["#7f1d1d", "#dc2626"]} style={s.choiceCard}>
                  <Text style={s.choiceCardEmoji}>🔥</Text>
                  <Text style={s.choiceCardTitle}>DARE</Text>
                  <Text style={s.choiceCardSub}>Take the risk</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Playing phase
  return (
    <LinearGradient colors={["#03001c", "#300010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.roundText}>Round {round + 1}/{MAX_ROUNDS}</Text>
          <View style={[s.choicePill, { backgroundColor: choice === "truth" ? "#1d4ed8" : "#dc2626" }]}>
            <Text style={s.choicePillText}>{choice === "truth" ? "TRUTH" : "DARE"}</Text>
          </View>
        </View>

        <Animated.View style={[s.promptSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={choice === "truth" ? ["#1e3a8a", "#1d4ed8"] : ["#7f1d1d", "#991b1b"]}
            style={s.promptCard}
          >
            <Text style={s.promptEmoji}>{choice === "truth" ? "💬" : "🔥"}</Text>
            <Text style={s.promptText}>{currentPrompt}</Text>
          </LinearGradient>
        </Animated.View>

        <View style={s.actionRow}>
          <TouchableOpacity onPress={handleDone} style={s.doneBtn} activeOpacity={0.85}>
            <LinearGradient colors={["#166534", "#16a34a"]} style={s.actionBtnInner}>
              <Text style={s.actionBtnText}>✓ Done</Text>
            </LinearGradient>
          </TouchableOpacity>
          {passed < 1 && (
            <TouchableOpacity onPress={handlePass} style={s.passBtn} activeOpacity={0.85}>
              <LinearGradient colors={["#374151", "#4b5563"]} style={s.actionBtnInner}>
                <Text style={s.actionBtnText}>Pass (1 left)</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
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
  sub: { color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12 },
  homeBtnText: { color: "#666", fontSize: 15 },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
  roundText: { color: "#888", fontWeight: "700", fontSize: 14 },
  choicePill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  choicePillText: { color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 1 },

  choicePrompt: { color: "#888", fontSize: 16, fontWeight: "700", marginBottom: 32 },
  choiceCards: { flexDirection: "row", gap: 16 },
  truthCardWrap: { flex: 1, borderRadius: 20, overflow: "hidden" },
  dareCardWrap: { flex: 1, borderRadius: 20, overflow: "hidden" },
  choiceCard: { padding: 28, alignItems: "center" },
  choiceCardEmoji: { fontSize: 40, marginBottom: 10 },
  choiceCardTitle: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  choiceCardSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 },

  promptSection: { flex: 1, paddingHorizontal: 20, justifyContent: "center" },
  promptCard: { borderRadius: 20, padding: 32, alignItems: "center" },
  promptEmoji: { fontSize: 48, marginBottom: 16 },
  promptText: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center", lineHeight: 28 },

  actionRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 32 },
  doneBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  passBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  actionBtnInner: { padding: 16, alignItems: "center" },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  statsGrid: { flexDirection: "row", gap: 16, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, alignItems: "center" },
  statNum: { fontSize: 40, fontWeight: "900" },
  statLabel: { color: "#666", fontSize: 12, fontWeight: "700" },
  bravery: { color: "#a78bfa", fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 32 },
});
