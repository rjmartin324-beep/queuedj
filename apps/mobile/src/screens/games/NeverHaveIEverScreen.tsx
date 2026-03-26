import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const PROMPTS = [
  "Never have I ever … lied about my age",
  "Never have I ever … ghosted someone I liked",
  "Never have I ever … eaten food that fell on the floor",
  "Never have I ever … faked being sick to skip work/school",
  "Never have I ever … stalked an ex on social media",
  "Never have I ever … forgotten someone's name mid-conversation",
  "Never have I ever … sent a text to the wrong person",
  "Never have I ever … laughed so hard I cried",
  "Never have I ever … pretended to laugh at a joke I didn't get",
  "Never have I ever … binge-watched an entire series in one day",
  "Never have I ever … called a teacher 'mom' or 'dad'",
  "Never have I ever … fallen asleep during a movie at the cinema",
  "Never have I ever … taken a photo of food before eating it",
  "Never have I ever … sung loudly in the car thinking no one could see",
  "Never have I ever … googled myself",
];

type Phase = "lobby" | "playing" | "results";

export default function NeverHaveIEverScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [haveCount, setHaveCount] = useState(0);
  const [neverCount, setNeverCount] = useState(0);
  const [log, setLog] = useState<{ prompt: string; choice: "have" | "never" }[]>([]);
  const [lastChoice, setLastChoice] = useState<"have" | "never" | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleHave = useRef(new Animated.Value(1)).current;
  const scaleNever = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 }}>
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
      const responses = mp.responses || {};
      const haveCount = Object.values(responses).filter((r: any) => r === "have").length;
      const neverCount = Object.values(responses).filter((r: any) => r === "never").length;
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 12 }}>RESULTS</Text>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 24 }}>{mp.currentPrompt}</Text>
              <View style={{ flexDirection: "row", gap: 16, marginBottom: 24, width: "100%" }}>
                <View style={[s.statBox, { borderColor: "#dc2626", flex: 1 }]}>
                  <Text style={[s.statNum, { color: "#dc2626" }]}>{haveCount}</Text>
                  <Text style={s.statLabel}>I HAVE</Text>
                </View>
                <View style={[s.statBox, { borderColor: "#16a34a", flex: 1 }]}>
                  <Text style={[s.statNum, { color: "#16a34a" }]}>{neverCount}</Text>
                  <Text style={s.statLabel}>NEVER</Text>
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
    return (
      <LinearGradient colors={["#03001c","#0a0010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.playingCenter}>
            <View style={s.promptCard}>
              <LinearGradient colors={["#1a1a3a","#0f0f28"]} style={s.promptCardInner}>
                <Text style={s.promptPrefix}>Never have I ever…</Text>
                <Text style={s.promptMain}>{mp.currentPrompt}</Text>
              </LinearGradient>
            </View>
          </View>
          {hasVoted ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#a78bfa", fontSize: 16, fontWeight: "700" }}>⏳ Waiting for others…</Text>
            </View>
          ) : (
            <View style={s.choiceRow}>
              <TouchableOpacity
                onPress={() => { setHasVoted(true); sendAction("respond", { choice: "have" }); }}
                style={[s.haveBtn, { flex: 1 }]}
                activeOpacity={0.8}
              >
                <LinearGradient colors={["#7f1d1d","#dc2626"]} style={s.choiceBtnInner}>
                  <Text style={s.choiceEmoji}>🍺</Text>
                  <Text style={s.choiceBtnText}>I HAVE</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setHasVoted(true); sendAction("respond", { choice: "never" }); }}
                style={[s.neverBtn, { flex: 1 }]}
                activeOpacity={0.8}
              >
                <LinearGradient colors={["#14532d","#16a34a"]} style={s.choiceBtnInner}>
                  <Text style={s.choiceEmoji}>😇</Text>
                  <Text style={s.choiceBtnText}>NEVER</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  function startGame() {
    setPhase("playing");
    setIdx(0);
    setHaveCount(0);
    setNeverCount(0);
    setLog([]);
    setLastChoice(null);
    animateCard();
  }

  function animateCard() {
    cardAnim.setValue(0);
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, damping: 14 }).start();
  }

  function choose(choice: "have" | "never") {
    setLastChoice(choice);
    if (choice === "have") {
      setHaveCount((c) => c + 1);
      Animated.sequence([
        Animated.timing(scaleHave, { toValue: 0.88, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleHave, { toValue: 1, useNativeDriver: true }),
      ]).start();
    } else {
      setNeverCount((c) => c + 1);
      Animated.sequence([
        Animated.timing(scaleNever, { toValue: 0.88, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleNever, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }

    setLog((l) => [...l, { prompt: PROMPTS[idx], choice }]);

    setTimeout(() => {
      if (idx + 1 >= PROMPTS.length) {
        setPhase("results");
      } else {
        setIdx((i) => i + 1);
        setLastChoice(null);
        animateCard();
      }
    }, 600);
  }

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#0d1a00"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>🍺</Text>
            <Text style={s.title}>Never Have I Ever</Text>
            <Text style={s.sub}>Confess or stay quiet — your call</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• A prompt appears on screen</Text>
              <Text style={s.ruleItem}>• Tap "I HAVE" if you've done it (drink!)</Text>
              <Text style={s.ruleItem}>• Tap "NEVER" to stay proud</Text>
              <Text style={s.ruleItem}>• {PROMPTS.length} rounds total</Text>
            </View>
            <TouchableOpacity style={s.playBtn} onPress={startGame}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.playBtnInner}>
                <Text style={s.playBtnText}>LET'S GO</Text>
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
        score={0}
        gameEmoji="🤫"
        gameTitle="Never Have I Ever"
        onPlayAgain={startGame}
      />
    );
  }

  // Playing
  const prompt = PROMPTS[idx];
  return (
    <LinearGradient colors={["#03001c", "#0d1a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.playingHeader}>
          <Text style={s.progress}>{idx + 1} / {PROMPTS.length}</Text>
          <Text style={s.drinkCount}>🍺 {haveCount}</Text>
        </View>

        <View style={s.playingCenter}>
          <Animated.View style={[s.promptCard, {
            opacity: cardAnim,
            transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          }]}>
            <LinearGradient colors={["#1a1a3a", "#0f0f28"]} style={s.promptCardInner}>
              <Text style={s.promptPrefix}>Never have I ever…</Text>
              <Text style={s.promptMain}>{prompt.replace("Never have I ever … ", "")}</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <View style={s.choiceRow}>
          <Animated.View style={{ transform: [{ scale: scaleHave }], flex: 1 }}>
            <TouchableOpacity
              onPress={() => choose("have")}
              disabled={!!lastChoice}
              style={s.haveBtn}
              activeOpacity={0.8}
            >
              <LinearGradient colors={["#7f1d1d", "#dc2626"]} style={s.choiceBtnInner}>
                <Text style={s.choiceEmoji}>🍺</Text>
                <Text style={s.choiceBtnText}>I HAVE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: scaleNever }], flex: 1 }}>
            <TouchableOpacity
              onPress={() => choose("never")}
              disabled={!!lastChoice}
              style={s.neverBtn}
              activeOpacity={0.8}
            >
              <LinearGradient colors={["#14532d", "#16a34a"]} style={s.choiceBtnInner}>
                <Text style={s.choiceEmoji}>😇</Text>
                <Text style={s.choiceBtnText}>NEVER</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
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
  playBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  playBtnInner: { padding: 18, alignItems: "center" },
  playBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 16, alignItems: "center" },
  homeBtnText: { color: "#666", fontSize: 15 },

  playingHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 12 },
  progress: { color: "#888", fontWeight: "700", fontSize: 14 },
  drinkCount: { color: "#fbbf24", fontWeight: "900", fontSize: 16 },

  playingCenter: { flex: 1, paddingHorizontal: 20, justifyContent: "center" },
  promptCard: { borderRadius: 20, overflow: "hidden" },
  promptCardInner: { padding: 32, minHeight: 200, justifyContent: "center", alignItems: "center" },
  promptPrefix: { color: "#555", fontSize: 13, fontWeight: "700", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  promptMain: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center", lineHeight: 32 },

  choiceRow: { flexDirection: "row", gap: 12, padding: 16, paddingBottom: 32 },
  haveBtn: { borderRadius: 16, overflow: "hidden" },
  neverBtn: { borderRadius: 16, overflow: "hidden" },
  choiceBtnInner: { padding: 20, alignItems: "center" },
  choiceEmoji: { fontSize: 28, marginBottom: 6 },
  choiceBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  resultsScroll: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40, alignItems: "center" },
  resultsTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 20 },
  statRow: { flexDirection: "row", gap: 16, marginBottom: 20 },
  statBox: { flex: 1, borderWidth: 1.5, borderRadius: 16, padding: 20, alignItems: "center" },
  statNum: { fontSize: 48, fontWeight: "900" },
  statLabel: { color: "#666", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  confessionRate: { color: "#a78bfa", fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 24 },
  logTitle: { color: "#555", fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 12, alignSelf: "flex-start" },
  logRow: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  logEmoji: { fontSize: 18 },
  logPrompt: { color: "#ccc", fontSize: 13, flex: 1 },
});
