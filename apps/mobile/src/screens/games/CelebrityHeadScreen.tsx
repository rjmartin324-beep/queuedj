import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const CELEBRITIES = [
  { name: "Taylor Swift", category: "Music" },
  { name: "Elon Musk", category: "Tech/Business" },
  { name: "Beyoncé", category: "Music" },
  { name: "Barack Obama", category: "Politics" },
  { name: "LeBron James", category: "Sports" },
  { name: "Oprah Winfrey", category: "Media" },
  { name: "Tom Hanks", category: "Film" },
  { name: "Billie Eilish", category: "Music" },
  { name: "Cristiano Ronaldo", category: "Sports" },
  { name: "Kim Kardashian", category: "Reality TV" },
  { name: "Dwayne Johnson", category: "Film/Sports" },
  { name: "Adele", category: "Music" },
  { name: "Jeff Bezos", category: "Tech/Business" },
  { name: "Serena Williams", category: "Sports" },
  { name: "Ryan Reynolds", category: "Film" },
];

type Phase = "lobby" | "setup" | "playing" | "round_end" | "results";

export default function CelebrityHeadScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [queue, setQueue] = useState<typeof CELEBRITIES>([]);
  const [current, setCurrent] = useState<typeof CELEBRITIES[0] | null>(null);
  const [score, setScore] = useState(0);
  const [guessed, setGuessed] = useState(0);
  const [passed, setPassed] = useState(0);
  const [timer, setTimer] = useState(60);
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

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

    if (mp.phase === "reveal") {
      return (
        <LinearGradient colors={["#03001c","#1a0030"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 8 }}>CELEBRITY WAS</Text>
              <Text style={{ color: "#e879f9", fontSize: 32, fontWeight: "900", marginBottom: 24 }}>{mp.celebrity}</Text>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 12 }}>SCORES</Text>
              {Object.entries(mp.scores||{}).sort(([,a],[,b])=>(b as number)-(a as number)).map(([gId,pts],i)=>(
                <View key={gId} style={{flexDirection:"row",justifyContent:"space-between",width:"100%",marginBottom:8}}>
                  <Text style={{color:"#ccc",fontSize:15}}>{i+1}. {memberName(gId)}</Text>
                  <Text style={{color:"#a78bfa",fontSize:15,fontWeight:"700"}}>{pts as number} pts</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "playing") {
      const isMe = myGuestId === mp.currentGuestId;
      const questionsAsked = mp.questionsAsked ?? 0;
      return (
        <LinearGradient colors={["#03001c","#1a0030"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topStats}>
              <Text style={s.topStatText}>❓ {questionsAsked} questions</Text>
              {!isMe && <Text style={s.topStatText}>{memberName(mp.currentGuestId)}'s turn</Text>}
            </View>
            <View style={s.cardSection}>
              {isMe ? (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#fbbf24", fontSize: 16, fontWeight: "800", marginBottom: 20, textAlign: "center" }}>
                    🎴 YOU ARE THE CELEBRITY
                  </Text>
                  <View style={s.cardWrap}>
                    <LinearGradient colors={["#2a1060","#b5179e"]} style={s.card}>
                      <Text style={s.cardCategory}>Ask YES/NO questions!</Text>
                      <Text style={s.cardName}>???</Text>
                    </LinearGradient>
                  </View>
                  <Text style={s.holdText}>Ask the group yes/no questions to guess who you are</Text>
                </View>
              ) : (
                <View style={{ alignItems: "center" }}>
                  <View style={s.cardWrap}>
                    <LinearGradient colors={["#2a1060","#b5179e"]} style={s.card}>
                      <Text style={s.cardCategory}>{mp.category ?? "Celebrity"}</Text>
                      <Text style={s.cardName}>{mp.celebrity}</Text>
                    </LinearGradient>
                  </View>
                  <Text style={s.holdText}>Don't say the name! Answer {memberName(mp.currentGuestId)}'s questions</Text>
                </View>
              )}
            </View>
            {isMe && (
              <View style={s.actionRow}>
                <TouchableOpacity onPress={() => sendAction("pass", {})} style={s.passBtn} activeOpacity={0.85}>
                  <LinearGradient colors={["#374151","#4b5563"]} style={s.actionInner}>
                    <Text style={s.actionText}>PASS →</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => sendAction("got_it", {})} style={s.correctBtn} activeOpacity={0.85}>
                  <LinearGradient colors={["#166534","#16a34a"]} style={s.actionInner}>
                    <Text style={s.actionText}>✓ GOT IT</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      );
    }
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startGame() {
    setPhase("setup");
    setScore(0);
    setGuessed(0);
    setPassed(0);
    const q = shuffle(CELEBRITIES);
    setQueue(q);
    setCurrent(q[0]);
    setCountdown(3);

    const countTimer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countTimer);
          beginPlaying(q);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function beginPlaying(q: typeof CELEBRITIES) {
    setPhase("playing");
    setTimer(60);
    barAnim.setValue(1);
    Animated.timing(barAnim, { toValue: 0, duration: 60000, useNativeDriver: false }).start();
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setPhase("round_end");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function handleCorrect() {
    setGuessed((g) => g + 1);
    setScore((s) => s + 200);
    next();
  }

  function handlePass() {
    setPassed((p) => p + 1);
    next();
  }

  function next() {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setQueue((q) => {
      const rest = q.slice(1);
      if (rest.length === 0) {
        clearInterval(timerRef.current!);
        setPhase("round_end");
        return q;
      }
      setCurrent(rest[0]);
      return rest;
    });
  }

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#1a0030"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>🎴</Text>
            <Text style={s.title}>Celebrity Head</Text>
            <Text style={s.sub}>You have a celebrity card on your forehead. Ask YES/NO questions to figure out who you are!</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• A celebrity appears on screen</Text>
              <Text style={s.ruleItem}>• Hold phone to forehead so others see the name</Text>
              <Text style={s.ruleItem}>• Ask yes/no questions — 60 seconds!</Text>
              <Text style={s.ruleItem}>• +200 pts per correct guess</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>READY</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "setup") {
    return (
      <LinearGradient colors={["#03001c", "#1a0030"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={s.countdownText}>{countdown}</Text>
            <Text style={s.countdownLabel}>Hold phone to your forehead!</Text>
            <Text style={s.countdownSub}>🤳 Face the screen OUT</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "round_end") {
    return (
      <LinearGradient colors={["#03001c", "#1a0030"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>⏰</Text>
            <Text style={s.title}>Time's Up!</Text>
            <View style={s.statsGrid}>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: "#4ade80" }]}>{guessed}</Text>
                <Text style={s.statLabel}>Guessed</Text>
              </View>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: "#fbbf24" }]}>{passed}</Text>
                <Text style={s.statLabel}>Passed</Text>
              </View>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: "#b5179e" }]}>{score}</Text>
                <Text style={s.statLabel}>Points</Text>
              </View>
            </View>
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

  return (
    <LinearGradient colors={["#03001c", "#1a0030"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.timerBar}>
          <Animated.View style={[s.timerFill, {
            width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            backgroundColor: timer <= 10 ? "#dc2626" : "#b5179e",
          }]} />
        </View>

        <View style={s.topStats}>
          <Text style={s.topStatText}>⏱ {timer}s</Text>
          <Text style={s.topStatText}>✓ {guessed}</Text>
          <Text style={s.topStatText}>→ {passed} passed</Text>
        </View>

        <View style={s.cardSection}>
          <Animated.View style={{ opacity: fadeAnim, alignItems: "center" }}>
            {current && (
              <>
                <View style={s.cardWrap}>
                  <LinearGradient colors={["#2a1060", "#b5179e"]} style={s.card}>
                    <Text style={s.cardCategory}>{current.category}</Text>
                    <Text style={s.cardName}>{current.name}</Text>
                  </LinearGradient>
                </View>
                <Text style={s.holdText}>🤳 Hold to forehead · ask YES/NO questions</Text>
              </>
            )}
          </Animated.View>
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity onPress={handlePass} style={s.passBtn} activeOpacity={0.85}>
            <LinearGradient colors={["#374151", "#4b5563"]} style={s.actionInner}>
              <Text style={s.actionText}>PASS →</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCorrect} style={s.correctBtn} activeOpacity={0.85}>
            <LinearGradient colors={["#166534", "#16a34a"]} style={s.actionInner}>
              <Text style={s.actionText}>✓ GOT IT</Text>
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
  title: { color: "#fff", fontSize: 32, fontWeight: "900", marginBottom: 16, textAlign: "center" },
  sub: { color: "#888", fontSize: 13, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12 },
  homeBtnText: { color: "#666", fontSize: 15 },
  countdownText: { color: "#b5179e", fontSize: 120, fontWeight: "900" },
  countdownLabel: { color: "#fff", fontSize: 20, fontWeight: "700" },
  countdownSub: { color: "#888", fontSize: 14, marginTop: 8 },

  timerBar: { height: 6, backgroundColor: "#1e1e3a", overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 3 },
  topStats: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 12 },
  topStatText: { color: "#888", fontSize: 14, fontWeight: "700" },

  cardSection: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  cardWrap: { width: "100%", borderRadius: 20, overflow: "hidden", marginBottom: 20 },
  card: { padding: 40, alignItems: "center" },
  cardCategory: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "700", marginBottom: 12, letterSpacing: 1 },
  cardName: { color: "#fff", fontSize: 36, fontWeight: "900", textAlign: "center" },
  holdText: { color: "#555", fontSize: 13, textAlign: "center" },

  actionRow: { flexDirection: "row", gap: 12, padding: 20, paddingBottom: 32 },
  passBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  correctBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  actionInner: { padding: 18, alignItems: "center" },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 32 },
  statBox: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, alignItems: "center" },
  statNum: { fontSize: 40, fontWeight: "900" },
  statLabel: { color: "#666", fontSize: 12, fontWeight: "700" },
});
