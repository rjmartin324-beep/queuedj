import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const CHALLENGES = [
  { task: "Name 5 countries starting with 'C'", category: "Geography" },
  { task: "Say 10 animals in alphabetical order", category: "Animals" },
  { task: "Name 5 movies with a number in the title", category: "Movies" },
  { task: "Say the months of the year backwards", category: "Memory" },
  { task: "Name 5 sports that don't use a ball", category: "Sports" },
  { task: "List 5 things in your room right now", category: "Awareness" },
  { task: "Name 5 superheroes and their superpowers", category: "Pop Culture" },
  { task: "Count from 10 to 1 in a foreign language", category: "Language" },
  { task: "Name 5 cheeses", category: "Food" },
  { task: "Say 5 words that rhyme with 'cat'", category: "Words" },
];

const CAT_COLORS: Record<string, string> = {
  Geography: "#22d3ee",
  Animals: "#4ade80",
  Movies: "#f472b6",
  Memory: "#a78bfa",
  Sports: "#fbbf24",
  Awareness: "#fb923c",
  "Pop Culture": "#e879f9",
  Language: "#34d399",
  Food: "#f87171",
  Words: "#60a5fa",
};

type Phase = "lobby" | "playing" | "results";

export default function SpeedRoundScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpDone, setMpDone] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [timer, setTimer] = useState(30);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (inRoom && mpState) {
    const mp = mpState;
    const isMyTurn = mp.currentPlayer === myGuestId;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>⚡</Text>
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
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "playing") {
      const catColor = CAT_COLORS[mp.category] ?? "#a78bfa";
      return (
        <LinearGradient colors={["#03001c","#001a1a"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Speed Round</Text>
              <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.scores?.[myGuestId??""]} pts</Text>
            </View>
            {mp.category && (
              <View style={{alignSelf:"flex-start",marginLeft:20,borderRadius:8,paddingHorizontal:12,paddingVertical:4,backgroundColor:catColor+"22"}}>
                <Text style={{fontSize:11,fontWeight:"900",letterSpacing:1,color:catColor}}>{mp.category}</Text>
              </View>
            )}
            <View style={{flex:1,paddingHorizontal:20,paddingVertical:20,justifyContent:"center"}}>
              <LinearGradient colors={["#1a1a3a","#2a1a4a"]} style={{borderRadius:20,padding:32,minHeight:160,justifyContent:"center"}}>
                <Text style={{color:"#fff",fontSize:22,fontWeight:"800",textAlign:"center",lineHeight:32}}>{mp.task ?? mp.challenge}</Text>
              </LinearGradient>
            </View>
            <Text style={{color:isMyTurn?"#4ade80":"#888",fontSize:14,fontWeight:"900",textAlign:"center",marginBottom:12}}>
              {isMyTurn ? "YOUR TURN — perform this!" : `${memberName(mp.currentPlayer??"")} is performing…`}
            </Text>
            {isMyTurn && !mpDone && (
              <View style={{flexDirection:"row",gap:12,paddingHorizontal:20,paddingBottom:24}}>
                <TouchableOpacity onPress={()=>{setMpDone(true);sendAction("skip",{});}} style={{flex:1,borderRadius:14,overflow:"hidden"}}>
                  <LinearGradient colors={["#374151","#4b5563"]} style={{padding:16,alignItems:"center"}}>
                    <Text style={{color:"#fff",fontSize:15,fontWeight:"900"}}>SKIP</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{setMpDone(true);sendAction("done",{});}} style={{flex:2,borderRadius:14,overflow:"hidden"}}>
                  <LinearGradient colors={["#166534","#16a34a"]} style={{padding:16,alignItems:"center"}}>
                    <Text style={{color:"#fff",fontSize:15,fontWeight:"900"}}>DONE!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c","#001a1a"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); setSkipped(0); loadChallenge(0); }

  function loadChallenge(i: number) {
    setDone(false); setTimer(30);
    barAnim.setValue(1); cardAnim.setValue(0);
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, damping: 12 }).start();
    Animated.timing(barAnim, { toValue: 0, duration: 30000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); timeOut(i); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function timeOut(i: number) { setDone(true); advance(i, 0); }

  function markDone(i: number) {
    clearInterval(timerRef.current!); barAnim.stopAnimation();
    const pts = 100 + timer * 10;
    setScore((s) => s + pts);
    advance(i, pts);
  }

  function skip(i: number) {
    clearInterval(timerRef.current!); barAnim.stopAnimation();
    setSkipped((sk) => sk + 1);
    advance(i, 0);
  }

  function advance(i: number, _pts: number) {
    setDone(true);
    setTimeout(() => {
      if (i + 1 >= CHALLENGES.length) setPhase("results");
      else { setIdx(i+1); loadChallenge(i+1); }
    }, 800);
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#001a1a"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>⚡</Text>
          <Text style={s.title}>Speed Round</Text>
          <Text style={s.sub}>Fast challenges across categories. Complete each task in 30 seconds — or skip it!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>GO GO GO!</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <PostGameCard
      score={score}
      maxScore={600}
      gameEmoji="⏱️"
      gameTitle="Speed Round"
      onPlayAgain={startGame}
    />
  );

  const ch = CHALLENGES[idx];
  const catColor = CAT_COLORS[ch.category] ?? "#a78bfa";
  return (
    <LinearGradient colors={["#03001c","#001a1a"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.prog}>{idx+1}/{CHALLENGES.length}</Text>
          <Text style={[s.timerNum, { color: timer <= 10 ? "#dc2626" : "#fff" }]}>{timer}s</Text>
        </View>
        <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }), backgroundColor: timer <= 10 ? "#dc2626" : catColor }]} /></View>
        <View style={[s.catBadge, { backgroundColor: catColor + "22" }]}><Text style={[s.catText, { color: catColor }]}>{ch.category}</Text></View>
        <Animated.View style={[s.cardSection, { opacity: cardAnim, transform: [{ scale: cardAnim.interpolate({ inputRange:[0,1], outputRange:[0.9,1] }) }] }]}>
          <LinearGradient colors={["#1a1a3a","#2a1a4a"]} style={s.challengeCard}>
            <Text style={s.challengeText}>{ch.task}</Text>
          </LinearGradient>
        </Animated.View>
        <View style={s.actionRow}>
          <TouchableOpacity onPress={() => skip(idx)} style={s.skipBtn} activeOpacity={0.8}>
            <LinearGradient colors={["#374151","#4b5563"]} style={s.actionI}><Text style={s.actionT}>SKIP</Text></LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => markDone(idx)} style={s.doneBtn} activeOpacity={0.85}>
            <LinearGradient colors={["#166534","#16a34a"]} style={s.actionI}><Text style={s.actionT}>✓ DONE (+{100 + timer * 10}pts)</Text></LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={s.scoreBar}><Text style={s.scoreText}>Score: {score}</Text></View>
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
  prog:{color:"#888",fontWeight:"700"},
  timerNum:{fontSize:22,fontWeight:"900"},
  timerTrack:{height:8,backgroundColor:"#1e1e3a",overflow:"hidden"},
  timerFill:{height:"100%"},
  catBadge:{alignSelf:"flex-start",marginLeft:20,marginTop:12,borderRadius:8,paddingHorizontal:12,paddingVertical:4},
  catText:{fontSize:11,fontWeight:"900",letterSpacing:1},
  cardSection:{flex:1,paddingHorizontal:20,paddingVertical:20,justifyContent:"center"},
  challengeCard:{borderRadius:20,padding:32,minHeight:160,justifyContent:"center"},
  challengeText:{color:"#fff",fontSize:22,fontWeight:"800",textAlign:"center",lineHeight:32},
  actionRow:{flexDirection:"row",gap:12,paddingHorizontal:20,paddingBottom:16},
  skipBtn:{flex:1,borderRadius:14,overflow:"hidden"}, doneBtn:{flex:2,borderRadius:14,overflow:"hidden"},
  actionI:{padding:16,alignItems:"center"}, actionT:{color:"#fff",fontSize:15,fontWeight:"900"},
  scoreBar:{padding:12,alignItems:"center"}, scoreText:{color:"#a78bfa",fontSize:14,fontWeight:"800"},
});
