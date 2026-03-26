import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, PanResponder, Dimensions, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const { width: SW } = Dimensions.get("window");
const SLIDER_W = SW - 48;

const TAKES = [
  "Pineapple belongs on pizza",
  "Cereal before milk is wrong",
  "Die Hard is a Christmas movie",
  "Cilantro tastes like soap",
  "Dogs are better than cats",
  "Social media has done more harm than good",
  "Working from home is more productive",
  "Print books are better than e-books",
  "Socks with sandals is fine",
  "Breakfast food is the best food at any time of day",
  "The original is always better than the remake",
  "Texting is better than calling",
];

type Phase = "lobby" | "playing" | "results";

interface TakeResult {
  take: string;
  myVal: number;
  avgVal: number;
}

export default function HotTakesScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [sliderVal, setSliderVal] = useState(50);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<TakeResult[]>([]);
  const slideX = useRef(new Animated.Value(SLIDER_W * 0.5)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [hasSlid, setHasSlid] = useState(false);

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
      const avg = mp.average ?? 50;
      const myVal = (mp.responses ?? {})[myGuestId ?? ""] ?? null;
      return (
        <LinearGradient colors={["#03001c","#1a1000"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 20 }}>{mp.currentStatement}</Text>
              <View style={{ width: "100%", marginBottom: 16 }}>
                <View style={[s.compareBar, { marginBottom: 8 }]}>
                  {myVal !== null && <View style={[s.myBar, { width: `${myVal}%` }]} />}
                  <Text style={s.barLabel}>You: {myVal ?? "?"}%</Text>
                </View>
                <View style={s.compareBar}>
                  <View style={[s.groupBar, { width: `${avg}%` }]} />
                  <Text style={s.barLabel}>Avg: {avg}%</Text>
                </View>
              </View>
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

    // phase === "question"
    const VOTE_VALS = [0, 25, 50, 75, 100];
    return (
      <LinearGradient colors={["#03001c","#1a1000"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.progress}>Question {mp.questionIndex != null ? mp.questionIndex + 1 : 1}</Text>
          </View>
          <View style={s.takeSection}>
            <LinearGradient colors={["#1e1e3a","#2a1a4a"]} style={s.takeCard}>
              <Text style={s.takeText}>{mp.currentStatement}</Text>
            </LinearGradient>
          </View>
          {hasSlid ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#a78bfa", fontSize: 16, fontWeight: "700" }}>⏳ Waiting for others…</Text>
            </View>
          ) : (
            <View style={s.sliderSection}>
              <View style={s.sliderLabels}>
                <Text style={s.sliderLabelLeft}>Strongly Disagree</Text>
                <Text style={s.sliderLabelRight}>Strongly Agree</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, gap: 8 }}>
                {VOTE_VALS.map(val => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => { setHasSlid(true); sendAction("slide", { value: val }); }}
                    style={{ flex: 1, borderRadius: 10, overflow: "hidden" }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={val <= 25 ? ["#7f1d1d","#dc2626"] : val >= 75 ? ["#166534","#16a34a"] : ["#374151","#4b5563"]}
                      style={{ padding: 12, alignItems: "center" }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{val}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  function startGame() {
    setPhase("playing");
    setIdx(0);
    setSliderVal(50);
    setSubmitted(false);
    setResults([]);
    animateIn();
  }

  function animateIn() {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gs) => {
        const x = Math.max(0, Math.min(SLIDER_W, gs.x0 - 24));
        slideX.setValue(x);
        setSliderVal(Math.round((x / SLIDER_W) * 100));
      },
      onPanResponderMove: (_, gs) => {
        const x = Math.max(0, Math.min(SLIDER_W, gs.moveX - 24));
        slideX.setValue(x);
        setSliderVal(Math.round((x / SLIDER_W) * 100));
      },
    })
  ).current;

  function submit() {
    if (submitted) return;
    setSubmitted(true);
    const avg = 30 + Math.random() * 50;
    setResults((r) => [...r, { take: TAKES[idx], myVal: sliderVal, avgVal: Math.round(avg) }]);
    setTimeout(() => {
      if (idx + 1 >= TAKES.length) {
        setPhase("results");
      } else {
        setIdx((i) => i + 1);
        setSliderVal(50);
        slideX.setValue(SLIDER_W * 0.5);
        setSubmitted(false);
        animateIn();
      }
    }, 1400);
  }

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#1a1000"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>🌶️</Text>
            <Text style={s.title}>Hot Takes</Text>
            <Text style={s.sub}>Rate every take from Strongly Disagree → Strongly Agree, then see how you compare to the group</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• Drag the slider to rate each take</Text>
              <Text style={s.ruleItem}>• After you lock in, see the group's average</Text>
              <Text style={s.ruleItem}>• {TAKES.length} takes to rate</Text>
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
    const avgDiff = results.reduce((sum, r) => sum + Math.abs(r.myVal - r.avgVal), 0) / results.length;
    return (
      <LinearGradient colors={["#03001c", "#1a1000"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <Text style={s.resultsHeader}>Your Hot Take Report</Text>
          <Text style={s.alignScore}>
            Average gap from group: {Math.round(avgDiff)} pts
            {avgDiff < 15 ? " — Mainstream 🤝" : avgDiff < 30 ? " — Independent thinker 🤔" : " — Spicy contrarian 🌶️"}
          </Text>
          <Animated.ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            {results.map((r, i) => (
              <View key={i} style={s.resultCard}>
                <Text style={s.resultTake}>{r.take}</Text>
                <View style={s.compareRow}>
                  <View style={s.compareBar}>
                    <View style={[s.myBar, { width: `${r.myVal}%` }]} />
                    <Text style={s.barLabel}>You: {r.myVal}%</Text>
                  </View>
                  <View style={s.compareBar}>
                    <View style={[s.groupBar, { width: `${r.avgVal}%` }]} />
                    <Text style={s.barLabel}>Group: {r.avgVal}%</Text>
                  </View>
                </View>
              </View>
            ))}
          </Animated.ScrollView>
          <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
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

  const take = TAKES[idx];
  const sliderPct = sliderVal / 100;
  const agree = sliderVal >= 70;
  const disagree = sliderVal <= 30;
  const neutral = !agree && !disagree;

  return (
    <LinearGradient colors={["#03001c", "#1a1000"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.progress}>{idx + 1}/{TAKES.length}</Text>
          <Text style={s.opinionLabel}>
            {disagree ? "🚫 Disagree" : agree ? "✅ Agree" : "😐 Neutral"}
          </Text>
        </View>

        <Animated.View style={[s.takeSection, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={disagree ? ["#1e1e3a", "#2d1a1a"] : agree ? ["#1a2d1a", "#1e3a1e"] : ["#1e1e3a", "#2a1a4a"]}
            style={s.takeCard}
          >
            <Text style={s.takeText}>{take}</Text>
          </LinearGradient>
        </Animated.View>

        <View style={s.sliderSection}>
          <View style={s.sliderLabels}>
            <Text style={s.sliderLabelLeft}>Strongly Disagree</Text>
            <Text style={s.sliderLabelRight}>Strongly Agree</Text>
          </View>
          <View style={s.sliderTrack} {...panResponder.panHandlers}>
            <LinearGradient
              colors={["#dc2626", "#fbbf24", "#16a34a"]}
              style={s.trackGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Animated.View style={[s.thumb, {
              left: slideX.interpolate({ inputRange: [0, SLIDER_W], outputRange: [0, SLIDER_W - 28] }),
              backgroundColor: disagree ? "#dc2626" : agree ? "#16a34a" : "#fbbf24",
            }]}>
              <Text style={s.thumbText}>{sliderVal}</Text>
            </Animated.View>
          </View>

          {!submitted ? (
            <TouchableOpacity style={s.lockBtn} onPress={submit} activeOpacity={0.85}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.lockBtnInner}>
                <Text style={s.lockBtnText}>LOCK IN →</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <Text style={s.waitText}>⏳ Revealing group opinion…</Text>
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
  sub: { color: "#888", fontSize: 13, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12, alignItems: "center" },
  homeBtnText: { color: "#666", fontSize: 15 },

  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  progress: { color: "#888", fontWeight: "700", fontSize: 14 },
  opinionLabel: { color: "#fff", fontWeight: "800", fontSize: 15 },

  takeSection: { flex: 1, paddingHorizontal: 20, justifyContent: "center" },
  takeCard: { borderRadius: 20, padding: 32, minHeight: 160, justifyContent: "center" },
  takeText: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center", lineHeight: 32 },

  sliderSection: { paddingHorizontal: 24, paddingBottom: 40 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  sliderLabelLeft: { color: "#dc2626", fontSize: 10, fontWeight: "700" },
  sliderLabelRight: { color: "#16a34a", fontSize: 10, fontWeight: "700" },
  sliderTrack: { height: 44, justifyContent: "center", marginBottom: 20, position: "relative" },
  trackGradient: { height: 8, borderRadius: 4 },
  thumb: { position: "absolute", width: 28, height: 28, borderRadius: 14, top: 8, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowRadius: 8, shadowOpacity: 0.4, elevation: 6 },
  thumbText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  lockBtn: { borderRadius: 14, overflow: "hidden" },
  lockBtnInner: { padding: 16, alignItems: "center" },
  lockBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  waitText: { color: "#888", fontSize: 15, textAlign: "center", padding: 16 },

  resultsHeader: { color: "#fff", fontSize: 22, fontWeight: "900", padding: 20, paddingBottom: 4 },
  alignScore: { color: "#a78bfa", fontSize: 14, paddingHorizontal: 20, marginBottom: 16 },
  resultCard: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, marginBottom: 10 },
  resultTake: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 12 },
  compareRow: { gap: 8 },
  compareBar: { height: 28, backgroundColor: "#1a1a2a", borderRadius: 8, overflow: "hidden", justifyContent: "center" },
  myBar: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#b5179e", borderRadius: 8 },
  groupBar: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#3b82f6", borderRadius: 8 },
  barLabel: { position: "absolute", right: 8, color: "#fff", fontSize: 11, fontWeight: "700" },
});
