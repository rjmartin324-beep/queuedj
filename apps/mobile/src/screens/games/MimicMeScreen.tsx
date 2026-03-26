import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const CHALLENGES = [
  { emoji: "😱", label: "Scream face", instruction: "Open your mouth wide, eyes HUGE, hands on cheeks!" },
  { emoji: "🤔", label: "Deep thinker", instruction: "Chin on hand, one eyebrow raised, look into the distance pensively" },
  { emoji: "😎", label: "Ultra cool", instruction: "Finger guns, slow nod, point at the camera" },
  { emoji: "🤢", label: "Disgusted", instruction: "Stick out tongue, scrunch nose, make a gagging sound" },
  { emoji: "😂", label: "Crying laughing", instruction: "Slap your knee, wipe fake tears, wheeze-laugh" },
  { emoji: "🤯", label: "Mind blown", instruction: "Both hands to temple, eyes wide, slowly mime explosion with hands" },
  { emoji: "😤", label: "Proud snob", instruction: "Tilt head up, cross arms, look down your nose at everyone" },
  { emoji: "🥴", label: "Confused/woozy", instruction: "Tilt head, roll eyes, stumble slightly" },
  { emoji: "🫡", label: "Saluting soldier", instruction: "Snap to attention, rigid back, crisp military salute" },
  { emoji: "🥶", label: "Freezing cold", instruction: "Hug yourself, shake violently, teeth chattering sound" },
];

type Phase = "lobby" | "showing" | "mimicking" | "scoring" | "results";

export default function MimicMeScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpRated, setMpRated] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [showTimer, setShowTimer] = useState(3);
  const [mimicTimer, setMimicTimer] = useState(10);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const emojiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (inRoom && mpState) {
    const mp = mpState;
    const isPerformer = mp.performer === myGuestId;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>🪞</Text>
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

    if (mp.phase === "studying") {
      return (
        <LinearGradient colors={["#03001c","#1a0a20"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Round {(mp.round??0)+1}/{mp.maxRounds??6}</Text>
              <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.scores?.[myGuestId??""]} pts</Text>
            </View>
            <View style={{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20}}>
              <Text style={{color:"#fbbf24",fontSize:14,fontWeight:"800",marginBottom:16}}>Study the pose! ({mp.timeLeft??3}s)</Text>
              <Text style={{fontSize:100,textAlign:"center",marginBottom:12}}>{mp.emoji}</Text>
              <Text style={{color:"#fff",fontSize:22,fontWeight:"900",marginBottom:16}}>{mp.label}</Text>
              <View style={{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:16,width:"100%"}}>
                <Text style={{color:"#ccc",fontSize:15,textAlign:"center",lineHeight:22}}>{mp.instruction}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "performing") {
      return (
        <LinearGradient colors={["#03001c","#1a0a20"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>{isPerformer?"DO IT NOW!":"Watch!"}</Text>
              <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.timeLeft??10}s</Text>
            </View>
            <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
              <Text style={{fontSize:80}}>{mp.emoji}</Text>
              {isPerformer ? (
                <Text style={{color:"#dc2626",fontSize:32,fontWeight:"900",marginTop:8}}>PERFORM IT!</Text>
              ) : (
                <Text style={{color:"#888",fontSize:16,marginTop:8}}>Watching {memberName(mp.performer??"")}…</Text>
              )}
              <Text style={{color:"#fff",fontSize:20,fontWeight:"900"}}>{mp.label}</Text>
              <Text style={{color:"#666",fontSize:13,textAlign:"center",paddingHorizontal:24,marginTop:8}}>{mp.instruction}</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "scoring") {
      return (
        <LinearGradient colors={["#03001c","#1a0a20"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24}}>
              <Text style={{color:"#fff",fontSize:20,fontWeight:"900",marginBottom:16}}>How was the performance?</Text>
              <Text style={{fontSize:64,marginBottom:24}}>{mp.emoji}</Text>
              <View style={{flexDirection:"row",gap:10,width:"100%"}}>
                {[["😬 Bad","bad",["#7f1d1d","#dc2626"]],["😊 Good","good",["#854d0e","#ca8a04"]],["🤩 Perfect!","perfect",["#166534","#16a34a"]]].map(([label,rating,colors])=>(
                  <TouchableOpacity key={rating as string} onPress={()=>{if(!mpRated&&!isPerformer){setMpRated(true);sendAction("rate",{rating});}}} disabled={mpRated||isPerformer} style={{flex:1,borderRadius:14,overflow:"hidden"}}>
                    <LinearGradient colors={colors as any} style={{padding:16,alignItems:"center"}}>
                      <Text style={{color:"#fff",fontSize:14,fontWeight:"900"}}>{label}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
              {(mpRated||isPerformer) && <Text style={{color:"#a78bfa",fontSize:14,fontWeight:"700",marginTop:16}}>⏳ Waiting…</Text>}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c","#1a0a20"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const MAX_ROUNDS = 6;

  function startGame() { setPhase("showing"); setRound(0); setScore(0); showChallenge(0); }

  function showChallenge(rIdx: number) {
    setIdx(rIdx);
    setShowTimer(3);
    spinAnim.setValue(0);
    emojiAnim.setValue(0);
    Animated.parallel([
      Animated.timing(spinAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(emojiAnim, { toValue: 1, useNativeDriver: true, damping: 10 }),
    ]).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setShowTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); startMimicking(rIdx); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function startMimicking(rIdx: number) {
    setPhase("mimicking");
    setMimicTimer(10);
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setMimicTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); setPhase("scoring"); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function ratePerformance(rating: "perfect"|"good"|"bad") {
    const pts = { perfect: 300, good: 150, bad: 0 }[rating];
    setScore((s) => s + pts);
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= MAX_ROUNDS) setPhase("results");
    else { setPhase("showing"); showChallenge(nextRound % CHALLENGES.length); }
  }

  const ch = CHALLENGES[idx % CHALLENGES.length];

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#1a0a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🪞😂</Text>
          <Text style={s.title}>Mimic Me</Text>
          <Text style={s.sub}>An emoji and instructions appear. You have 10 seconds to nail the pose/expression. Others rate you!</Text>
          <View style={s.rules}>{[`${MAX_ROUNDS} challenges to perform`, "3 seconds to study the pose", "Group rates: Perfect / Good / Bad", "300 pts for a perfect performance"].map((r,i)=><Text key={i} style={s.rule}>• {r}</Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START PERFORMING</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#1a0a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🪞</Text>
          <Text style={s.title}>Performance Over!</Text>
          <Text style={s.bigScore}>{score}</Text>
          <Text style={s.label}>PERFORMANCE POINTS</Text>
          <Text style={s.verdict}>{score >= 1200 ? "🎭 Oscar Winner!" : score >= 800 ? "😊 Natural Performer" : score >= 400 ? "🙂 Trying Hard" : "😅 No future in acting"}</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>ANOTHER ROUND</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "showing") return (
    <LinearGradient colors={["#03001c","#1a0a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>Round {round+1}/{MAX_ROUNDS}</Text><Text style={s.scoreC}>{score} pts</Text></View>
        <View style={s.showSection}>
          <Text style={s.studyLabel}>Study the pose! ({showTimer}s)</Text>
          <Animated.Text style={[s.bigEmoji, {
            transform: [{ scale: emojiAnim.interpolate({ inputRange:[0,1], outputRange:[0.5,1] }) }, { rotate: spinAnim.interpolate({ inputRange:[0,1], outputRange:["180deg","0deg"] }) }],
            opacity: emojiAnim,
          }]}>{ch.emoji}</Animated.Text>
          <Text style={s.chLabel}>{ch.label}</Text>
          <View style={s.instructBox}><Text style={s.instructText}>{ch.instruction}</Text></View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "mimicking") return (
    <LinearGradient colors={["#03001c","#1a0a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>DO IT NOW!</Text><Text style={s.scoreC}>{mimicTimer}s</Text></View>
        <View style={s.mimicSection}>
          <Text style={s.mirrorEmoji}>{ch.emoji}</Text>
          <Text style={s.goText}>PERFORM IT!</Text>
          <Text style={s.chLabel}>{ch.label}</Text>
          <Text style={s.instructSm}>{ch.instruction}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "scoring") return (
    <LinearGradient colors={["#03001c","#1a0a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={s.rateTitle}>How was the performance?</Text>
          <Text style={s.rateEmoji}>{ch.emoji}</Text>
          <View style={s.rateButtons}>
            <TouchableOpacity onPress={() => ratePerformance("bad")} style={s.rateWrap} activeOpacity={0.85}>
              <LinearGradient colors={["#7f1d1d","#dc2626"]} style={s.rateBtn}><Text style={s.rateBtnT}>😬 Bad</Text></LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => ratePerformance("good")} style={s.rateWrap} activeOpacity={0.85}>
              <LinearGradient colors={["#854d0e","#ca8a04"]} style={s.rateBtn}><Text style={s.rateBtnT}>😊 Good</Text></LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => ratePerformance("perfect")} style={s.rateWrap} activeOpacity={0.85}>
              <LinearGradient colors={["#166534","#16a34a"]} style={s.rateBtn}><Text style={s.rateBtnT}>🤩 Perfect!</Text></LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  return null;
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:20},
  rules:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:14,width:"100%",marginBottom:28},
  rule:{color:"#ccc",fontSize:13,marginBottom:5},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:15,fontWeight:"700",marginBottom:28,textAlign:"center"},
  topBar:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, scoreC:{color:"#a78bfa",fontWeight:"800"},
  showSection:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20},
  studyLabel:{color:"#fbbf24",fontSize:14,fontWeight:"800",marginBottom:16},
  bigEmoji:{fontSize:100,textAlign:"center",marginBottom:12},
  chLabel:{color:"#fff",fontSize:22,fontWeight:"900",marginBottom:16},
  instructBox:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:16,width:"100%"},
  instructText:{color:"#ccc",fontSize:15,textAlign:"center",lineHeight:22},
  mimicSection:{flex:1,alignItems:"center",justifyContent:"center"},
  mirrorEmoji:{fontSize:80},
  goText:{color:"#dc2626",fontSize:32,fontWeight:"900",marginTop:8},
  instructSm:{color:"#666",fontSize:13,textAlign:"center",paddingHorizontal:24,marginTop:8},
  rateTitle:{color:"#fff",fontSize:20,fontWeight:"900",marginBottom:16},
  rateEmoji:{fontSize:64,marginBottom:24},
  rateButtons:{flexDirection:"row",gap:10,width:"100%"},
  rateWrap:{flex:1,borderRadius:14,overflow:"hidden"},
  rateBtn:{padding:16,alignItems:"center"}, rateBtnT:{color:"#fff",fontSize:14,fontWeight:"900"},
});
