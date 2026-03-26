import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const ACTIONS: Record<number, { desc: string; pts: number; emoji: string }[]> = {
  1: [
    { desc: "Take a sip of your drink", pts: 50, emoji: "🥤" },
    { desc: "Say something nice to the person on your left", pts: 100, emoji: "💬" },
    { desc: "Do 5 jumping jacks right now", pts: 150, emoji: "🏃" },
  ],
  2: [
    { desc: "Tell your funniest joke — others rate it", pts: 150, emoji: "😂" },
    { desc: "Imitate someone in this group — they have to guess who", pts: 200, emoji: "🎭" },
    { desc: "Give a dramatic speech about your favorite food", pts: 100, emoji: "🎤" },
  ],
  3: [
    { desc: "Spin in place 3 times then try to walk straight", pts: 200, emoji: "🌀" },
    { desc: "Say the alphabet backwards as fast as you can", pts: 250, emoji: "🔤" },
    { desc: "Do your best dance move for 10 seconds", pts: 150, emoji: "🕺" },
  ],
  4: [
    { desc: "Everyone takes a group selfie — you get to pose", pts: 200, emoji: "📸" },
    { desc: "Whisper something you've never told the group", pts: 300, emoji: "🤫" },
    { desc: "Rate every person in the room's vibe out of 10", pts: 200, emoji: "📊" },
  ],
  5: [
    { desc: "You control the music for the next 2 minutes!", pts: 400, emoji: "🎵" },
    { desc: "Everyone has to compliment you for 30 seconds", pts: 350, emoji: "👑" },
    { desc: "Invent a new word and use it in a sentence", pts: 300, emoji: "📚" },
  ],
  6: [
    { desc: "Make a toast to the group — be heartfelt", pts: 500, emoji: "🥂" },
    { desc: "You pick someone to do a dare of your choosing", pts: 450, emoji: "🎯" },
    { desc: "Freestyle rap for 15 seconds — any topic", pts: 400, emoji: "🎤" },
  ],
};

const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

type Phase = "lobby" | "rolling" | "action" | "results";

export default function PartyDiceScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [diceVal, setDiceVal] = useState(1);
  const [action, setAction] = useState<{desc:string;pts:number;emoji:string}|null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [rolling, setRolling] = useState(false);
  const rollAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const MAX_ROUNDS = 6;
  const rollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => () => clearInterval(rollRef.current!), []);

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

    if (mpPhase === "rolling") {
      const isRoller = mp.currentRoller === myGuestId;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ color: "#888", fontWeight: "700" }}>Round {(mp.round ?? 0) + 1}</Text>
              <Text style={{ color: "#a78bfa", fontWeight: "800" }}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 120, textAlign: "center", marginBottom: 16 }}>{FACES[(mp.diceVal ?? 1) - 1]}</Text>
              {isRoller ? (
                <>
                  <Text style={{ color: "#fbbf24", fontSize: 18, fontWeight: "900", marginBottom: 32 }}>YOUR TURN! Roll the dice!</Text>
                  <TouchableOpacity onPress={() => sendAction("roll")} style={{ borderRadius: 14, overflow: "hidden", width: 160 }} activeOpacity={0.8}>
                    <LinearGradient colors={["#b5179e", "#7209b7"]} style={{ padding: 18, alignItems: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>ROLL!</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" }}>{memberName(mp.currentRoller ?? "")} is rolling…</Text>
                  <Text style={{ color: "#888", fontSize: 14, marginTop: 8 }}>Watch and wait!</Text>
                </>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "action") {
      const isRoller = mp.currentRoller === myGuestId;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ color: "#888", fontWeight: "700" }}>Round {(mp.round ?? 0) + 1}</Text>
              <Text style={{ color: "#a78bfa", fontWeight: "800" }}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "center" }}>
              <Text style={{ color: "#a78bfa", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 20 }}>
                {isRoller ? "You" : memberName(mp.currentRoller ?? "")} rolled a {mp.diceVal}! {FACES[(mp.diceVal ?? 1) - 1]}
              </Text>
              <View style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
                <LinearGradient colors={["#1a1a3a", "#2d1060"]} style={{ padding: 32, alignItems: "center" }}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>{mp.currentAction?.emoji}</Text>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center", lineHeight: 28, marginBottom: 12 }}>{mp.currentAction?.desc}</Text>
                  <Text style={{ color: "#b5179e", fontSize: 24, fontWeight: "900" }}>+{mp.currentAction?.pts} pts</Text>
                </LinearGradient>
              </View>
              {isRoller && (
                <TouchableOpacity onPress={() => sendAction("complete")} style={{ width: "100%", borderRadius: 14, overflow: "hidden" }} activeOpacity={0.85}>
                  <LinearGradient colors={["#166534", "#16a34a"]} style={{ padding: 18, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>✓ DONE — NEXT ROUND</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              {!isRoller && <Text style={{ color: "#888", fontSize: 14, textAlign: "center", marginTop: 8 }}>Waiting for {memberName(mp.currentRoller ?? "")} to complete…</Text>}
            </View>
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

  function startGame() { setPhase("rolling"); setRound(0); setScore(0); }

  function rollDice() {
    if (rolling) return;
    setRolling(true);
    let count = 0;
    rollRef.current = setInterval(() => {
      setDiceVal(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 15) {
        clearInterval(rollRef.current!);
        const final = Math.floor(Math.random() * 6) + 1;
        setDiceVal(final);
        const acts = ACTIONS[final];
        const chosen = acts[Math.floor(Math.random() * acts.length)];
        setAction(chosen);
        setRolling(false);
        Animated.spring(bounceAnim, { toValue: 1, useNativeDriver: true, damping: 8 }).start(() => bounceAnim.setValue(0));
        setPhase("action");
      }
    }, 80);
  }

  function complete() {
    if (action) setScore((s) => s + action.pts);
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= MAX_ROUNDS) setPhase("results");
    else { setPhase("rolling"); setAction(null); }
  }

  useEffect(() => () => clearInterval(rollRef.current!), []);

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#1a0020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🎲</Text>
          <Text style={s.title}>Party Dice</Text>
          <Text style={s.sub}>Roll the dice to get a party challenge! Higher numbers = spicier actions. {MAX_ROUNDS} rounds!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>ROLL TO START!</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <PostGameCard
      score={score}
      maxScore={600}
      gameEmoji="🎲"
      gameTitle="Party Dice"
      onPlayAgain={startGame}
    />
  );

  if (phase === "rolling") return (
    <LinearGradient colors={["#03001c","#1a0020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>Round {round+1}/{MAX_ROUNDS}</Text><Text style={s.scoreC}>{score} pts</Text></View>
        <View style={s.rollSection}>
          <Text style={s.diceEmoji}>{FACES[diceVal - 1]}</Text>
          <Text style={s.rollLabel}>{rolling ? "Rolling…" : "Tap to roll!"}</Text>
          <TouchableOpacity onPress={rollDice} disabled={rolling} style={s.rollBtn} activeOpacity={0.8}>
            <LinearGradient colors={["#b5179e","#7209b7"]} style={s.rollBtnI}>
              <Text style={s.rollBtnT}>{rolling ? "🎲" : "ROLL!"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <LinearGradient colors={["#03001c","#1a0020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>Round {round+1}/{MAX_ROUNDS}</Text><Text style={s.scoreC}>{score} pts</Text></View>
        <View style={s.actionSection}>
          <Text style={s.rolledText}>You rolled a {diceVal}! {FACES[diceVal - 1]}</Text>
          <View style={s.actionCard}>
            <LinearGradient colors={["#1a1a3a","#2d1060"]} style={s.actionCardI}>
              <Text style={s.actionEmoji}>{action?.emoji}</Text>
              <Text style={s.actionDesc}>{action?.desc}</Text>
              <Text style={s.actionPts}>+{action?.pts} pts</Text>
            </LinearGradient>
          </View>
          <TouchableOpacity style={s.btn} onPress={complete}><LinearGradient colors={["#166534","#16a34a"]} style={s.btnI}><Text style={s.btnT}>✓ DONE — NEXT ROUND</Text></LinearGradient></TouchableOpacity>
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
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topBar:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, scoreC:{color:"#a78bfa",fontWeight:"800"},
  rollSection:{flex:1,alignItems:"center",justifyContent:"center"},
  diceEmoji:{fontSize:120,textAlign:"center"},
  rollLabel:{color:"#888",fontSize:16,fontWeight:"700",marginBottom:32},
  rollBtn:{borderRadius:14,overflow:"hidden",width:160},
  rollBtnI:{padding:18,alignItems:"center"}, rollBtnT:{color:"#fff",fontSize:20,fontWeight:"900"},
  actionSection:{flex:1,paddingHorizontal:20,justifyContent:"center"},
  rolledText:{color:"#a78bfa",fontSize:18,fontWeight:"800",textAlign:"center",marginBottom:20},
  actionCard:{borderRadius:20,overflow:"hidden",marginBottom:24},
  actionCardI:{padding:32,alignItems:"center"},
  actionEmoji:{fontSize:48,marginBottom:12},
  actionDesc:{color:"#fff",fontSize:20,fontWeight:"700",textAlign:"center",lineHeight:28,marginBottom:12},
  actionPts:{color:"#b5179e",fontSize:24,fontWeight:"900"},
});
