import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const SCENARIOS = [
  { s: "A squirrel has stolen your phone and is running up a tree", a: "I'd climb that tree", b: "I'd offer it nuts to negotiate" },
  { s: "You open your fridge and a small raccoon gives you direct eye contact", a: "I'm closing the fridge and leaving", b: "I'm calmly calling animal control while maintaining eye contact" },
  { s: "Your dentist starts humming a funeral march mid-procedure", a: "I'm asking what that's about", b: "I'm silent and pretending I didn't hear" },
  { s: "A pigeon on the subway sits next to you and opens a tiny newspaper", a: "I'm starting a conversation", b: "I'm moving seats immediately" },
  { s: "Your boss sends you an email at 11pm that just says 'we need to talk'", a: "I'm replying immediately asking what's wrong", b: "I'm putting my phone in another room and sleeping fine" },
  { s: "You discover your houseplant has been sending you passive-aggressive texts", a: "I confront it directly", b: "I water it more to win its affection" },
  { s: "A bear wanders into your home office during a Zoom call", a: "I quietly leave the frame and call 911", b: "I mute myself and hope nobody notices" },
  { s: "You find out you've accidentally been married in a foreign country for 12 years", a: "I'm flying there to sort this out", b: "I'm consulting a lawyer first" },
];

const MAJORITY = ["b","a","b","a","b","a","a","b"];
type Phase = "lobby" | "playing" | "results";

export default function FightOrFlightScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<"a"|"b"|null>(null);
  const [score, setScore] = useState(0);
  const scaleA = useRef(new Animated.Value(1)).current;
  const scaleB = useRef(new Animated.Value(1)).current;

  // ── Multiplayer block ──────────────────────────────────────────────────────
  if (inRoom && mpState) {
    const mp = mpState;
    const mpPhase: string = mp.phase ?? "waiting";

    if (mpPhase === "finished") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
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
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" }}>Waiting for game to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "question") {
      const myChoice = mp.choices?.[myGuestId ?? ""];
      const sc = mp.scenario ?? {};
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}><Text style={s.prog}>{(mp.questionIndex ?? 0) + 1}/{mp.totalQuestions ?? "?"}</Text><Text style={s.scoreC}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text></View>
            <View style={s.scenarioSection}><Text style={s.scenarioText}>{sc.scenario ?? sc.s ?? mp.scenarioText}</Text></View>
            <View style={s.choices}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={() => { if (!myChoice) sendAction("choose", { choice: "a" }); }} disabled={!!myChoice} activeOpacity={0.85} style={s.choiceWrap}>
                  <LinearGradient colors={myChoice === "a" ? ["#7209b7","#b5179e"] : ["#1e1e3a","#2a1a4a"]} style={s.choiceCard}>
                    <Text style={s.choiceLabel}>Option A</Text>
                    <Text style={s.choiceText}>{sc.optionA ?? sc.a ?? mp.optionA}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={() => { if (!myChoice) sendAction("choose", { choice: "b" }); }} disabled={!!myChoice} activeOpacity={0.85} style={s.choiceWrap}>
                  <LinearGradient colors={myChoice === "b" ? ["#7209b7","#b5179e"] : ["#1e1e3a","#2a1a4a"]} style={s.choiceCard}>
                    <Text style={s.choiceLabel}>Option B</Text>
                    <Text style={s.choiceText}>{sc.optionB ?? sc.b ?? mp.optionB}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            {myChoice && <Text style={s.majorityText}>⏳ Waiting for others…</Text>}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const aCount: number = mp.aCount ?? 0;
      const bCount: number = mp.bCount ?? 0;
      const total = aCount + bCount || 1;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 12, textAlign: "center" }}>Vote Split</Text>
              <View style={{ flexDirection: "row", height: 40, width: "100%", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <View style={{ flex: aCount / total, backgroundColor: "#7209b7" }}><Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", padding: 8 }}>A: {aCount}</Text></View>
                <View style={{ flex: bCount / total, backgroundColor: "#1e40af" }}><Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", padding: 8 }}>B: {bCount}</Text></View>
              </View>
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

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); setChoice(null); }

  function pick(c: "a"|"b") {
    if (choice) return;
    setChoice(c);
    const correct = c === MAJORITY[idx];
    if (correct) setScore((s) => s + 200);
    Animated.sequence([
      Animated.timing(c === "a" ? scaleA : scaleB, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(c === "a" ? scaleA : scaleB, { toValue: 1, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      if (idx + 1 >= SCENARIOS.length) setPhase("results");
      else { setIdx((i) => i + 1); setChoice(null); }
    }, 1400);
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#200000"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>⚔️🦅</Text>
          <Text style={s.title}>Fight or Flight</Text>
          <Text style={s.sub}>Wild scenarios — pick what you'd actually do. Match the group's majority for points!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>FACE YOUR FEARS</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#200000"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🏆</Text>
          <Text style={s.title}>You Survived!</Text>
          <Text style={s.bigScore}>{score}</Text>
          <Text style={s.label}>SURVIVAL POINTS</Text>
          <Text style={s.verdict}>{score >= 1200 ? "🦁 Absolute Legend" : score >= 800 ? "😤 Fighter" : score >= 400 ? "🤔 Reasonable" : "🐔 Pure Flight Mode"}</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>PLAY AGAIN</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  const sc = SCENARIOS[idx];
  return (
    <LinearGradient colors={["#03001c","#200000"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>{idx+1}/{SCENARIOS.length}</Text><Text style={s.scoreC}>Score: {score}</Text></View>
        <View style={s.scenarioSection}><Text style={s.scenarioText}>{sc.s}</Text></View>
        {choice && <Text style={s.majorityText}>👥 Group chose: {MAJORITY[idx] === "a" ? sc.a : sc.b}</Text>}
        <View style={s.choices}>
          <Animated.View style={[{ flex: 1, transform: [{ scale: scaleA }] }]}>
            <TouchableOpacity onPress={() => pick("a")} disabled={!!choice} activeOpacity={0.85} style={s.choiceWrap}>
              <LinearGradient colors={choice === "a" ? (MAJORITY[idx]==="a" ? ["#166534","#16a34a"] : ["#7f1d1d","#dc2626"]) : ["#1e1e3a","#2a1a4a"]} style={s.choiceCard}>
                <Text style={s.choiceLabel}>Option A</Text>
                <Text style={s.choiceText}>{sc.a}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[{ flex: 1, transform: [{ scale: scaleB }] }]}>
            <TouchableOpacity onPress={() => pick("b")} disabled={!!choice} activeOpacity={0.85} style={s.choiceWrap}>
              <LinearGradient colors={choice === "b" ? (MAJORITY[idx]==="b" ? ["#166534","#16a34a"] : ["#7f1d1d","#dc2626"]) : ["#1e1e3a","#2a1a4a"]} style={s.choiceCard}>
                <Text style={s.choiceLabel}>Option B</Text>
                <Text style={s.choiceText}>{sc.b}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12,alignItems:"center"}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28,textAlign:"center"},
  topBar:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, scoreC:{color:"#a78bfa",fontWeight:"800"},
  scenarioSection:{flex:1,paddingHorizontal:20,justifyContent:"center",alignItems:"center"},
  scenarioText:{color:"#fff",fontSize:22,fontWeight:"800",textAlign:"center",lineHeight:30},
  majorityText:{color:"#888",fontSize:13,textAlign:"center",paddingHorizontal:20,paddingBottom:8},
  choices:{flexDirection:"row",gap:12,padding:16,paddingBottom:32},
  choiceWrap:{borderRadius:16,overflow:"hidden"},
  choiceCard:{padding:20,minHeight:100,justifyContent:"center"},
  choiceLabel:{color:"rgba(255,255,255,0.4)",fontSize:10,fontWeight:"900",marginBottom:8},
  choiceText:{color:"#fff",fontSize:14,fontWeight:"600",lineHeight:20},
});
