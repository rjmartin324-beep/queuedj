import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const SCENARIOS = [
  { who: "A time-traveler", where: "in a McDonald's drive-thru", situation: "trying to order food but only knows medieval currency" },
  { who: "A dog", where: "at a job interview", situation: "who just got distracted by a squirrel outside the window" },
  { who: "A robot", where: "on a first date", situation: "who forgot to update their human emotion software" },
  { who: "A pirate", where: "at the airport security check", situation: "whose metal hook keeps setting off the detector" },
  { who: "A grandma", where: "in an escape room", situation: "who thinks it's a real emergency" },
  { who: "A superhero", where: "at a parent-teacher conference", situation: "whose cape keeps knocking things over" },
  { who: "A cat", where: "at a therapy session", situation: "who refuses to acknowledge they have any issues" },
  { who: "A haunted house ghost", where: "trying to rent an apartment", situation: "who has to explain their 'unique living situation'" },
  { who: "A caveman", where: "in a modern smartphone store", situation: "trying to trade a mammoth tusk for an iPhone" },
  { who: "A mermaid", where: "taking a driving test", situation: "who keeps accidentally flooding the car" },
];

type Phase = "lobby" | "playing" | "results";

export default function ImprovChallengeScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpRated, setMpRated] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [timer, setTimer] = useState(60);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (inRoom && mpState) {
    const mp = mpState;
    const isPerformer = mp.performer === myGuestId;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>🎭</Text>
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

    if (mp.phase === "performing") {
      return (
        <LinearGradient colors={["#03001c","#1a0a20"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Improv Challenge</Text>
              <Text style={{color:"#fff",fontSize:22,fontWeight:"900"}}>{mp.timeLeft??60}s</Text>
            </View>
            <View style={{flex:1,paddingHorizontal:20,paddingVertical:24,justifyContent:"center"}}>
              <LinearGradient colors={["#1a0a3a","#2d1060"]} style={{borderRadius:20,padding:28,gap:20}}>
                {[["WHO",mp.who,"#e879f9","#b5179e33"],["WHERE",mp.where,"#60a5fa","#3b82f633"],["WHAT",mp.situation,"#fb923c","#f9731633"]].map(([label,val,color,bg])=>(
                  <View key={label as string} style={{flexDirection:"row",alignItems:"center",gap:12}}>
                    <View style={{borderRadius:6,paddingHorizontal:10,paddingVertical:4,backgroundColor:bg as string}}>
                      <Text style={{fontSize:10,fontWeight:"900",letterSpacing:1,color:color as string}}>{label}</Text>
                    </View>
                    <Text style={{color:"#fff",fontSize:17,fontWeight:"700",flex:1,lineHeight:24}}>{val}</Text>
                  </View>
                ))}
              </LinearGradient>
            </View>
            <Text style={{color:"#888",fontSize:14,textAlign:"center",paddingBottom:8}}>
              {isPerformer ? "🎭 Perform this scenario!" : `🎭 Watch ${memberName(mp.performer??"")} perform!`}
            </Text>
            {isPerformer && (
              <View style={{paddingHorizontal:20,paddingBottom:32}}>
                <TouchableOpacity onPress={()=>sendAction("done",{})} style={{borderRadius:14,overflow:"hidden"}}>
                  <LinearGradient colors={["#166534","#16a34a"]} style={{padding:18,alignItems:"center"}}>
                    <Text style={{color:"#fff",fontSize:17,fontWeight:"900"}}>✓ SCENE! (End Early)</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "rating") {
      return (
        <LinearGradient colors={["#03001c","#1a0a20"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20}}>
              <Text style={{color:"#fff",fontSize:20,fontWeight:"900",marginBottom:8}}>Rate the performance!</Text>
              <Text style={{color:"#e879f9",fontSize:16,fontWeight:"800",marginBottom:24}}>{memberName(mp.performer??"")}</Text>
              <View style={{flexDirection:"row",gap:8,width:"100%"}}>
                {[["😬 Bad",0,"#7f1d1d","#dc2626"],["😊 OK",100,"#854d0e","#ca8a04"],["👏 Good",200,"#1e40af","#3b82f6"],["🤩 Spot On!",350,"#166534","#16a34a"]].map(([label,pts,c1,c2])=>(
                  <TouchableOpacity key={label as string} onPress={()=>{if(!mpRated){setMpRated(true);sendAction("rate",{pts});}}} disabled={mpRated||isPerformer} style={{flex:1,borderRadius:12,overflow:"hidden"}}>
                    <LinearGradient colors={[c1 as string,c2 as string]} style={{padding:14,alignItems:"center"}}>
                      <Text style={{color:"#fff",fontSize:12,fontWeight:"900",textAlign:"center"}}>{label}{"\n"}+{pts}</Text>
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

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); startRound(0); }

  function startRound(i: number) {
    setDone(false); setTimer(60);
    barAnim.setValue(1);
    cardAnim.setValue(0);
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, damping: 12 }).start();
    Animated.timing(barAnim, { toValue: 0, duration: 60000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); finishRound(i); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function finishRound(i: number) {
    setDone(true);
    setScore((s) => s + 300);
  }

  function nextScenario() {
    if (idx + 1 >= SCENARIOS.length) setPhase("results");
    else { const ni = idx + 1; setIdx(ni); startRound(ni); }
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#1a0a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🎭</Text>
          <Text style={s.title}>Improv Challenge</Text>
          <Text style={s.sub}>A random character, place, and situation. You have 60 seconds to act it out live!</Text>
          <View style={s.rules}>{["Get a random improv scenario","60 seconds to perform it","Your party rates it live","Pick 3-5 scenarios to play"].map((r,i)=><Text key={i} style={s.rule}>• {r}</Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>GET SCENARIO</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#1a0a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🎭</Text>
          <Text style={s.title}>Scene! That's a wrap!</Text>
          <Text style={s.bigScore}>{score}</Text>
          <Text style={s.label}>IMPROV POINTS</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>MORE SCENARIOS</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  const sc = SCENARIOS[idx];
  return (
    <LinearGradient colors={["#03001c","#1a0a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.prog}>Scenario {idx+1}/{SCENARIOS.length}</Text>
          <Text style={[s.timerText, { color: timer <= 15 ? "#dc2626" : "#fff" }]}>{timer}s</Text>
        </View>
        <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }), backgroundColor: timer <= 15 ? "#dc2626" : "#b5179e" }]} /></View>

        <Animated.View style={[s.cardSection, { opacity: cardAnim, transform: [{ scale: cardAnim.interpolate({ inputRange:[0,1], outputRange:[0.85,1] }) }] }]}>
          <LinearGradient colors={["#1a0a3a","#2d1060"]} style={s.scenarioCard}>
            <View style={s.tagRow}>
              <View style={[s.tag, { backgroundColor: "#b5179e33" }]}><Text style={[s.tagText, { color: "#e879f9" }]}>WHO</Text></View>
              <Text style={s.tagValue}>{sc.who}</Text>
            </View>
            <View style={s.tagRow}>
              <View style={[s.tag, { backgroundColor: "#3b82f633" }]}><Text style={[s.tagText, { color: "#60a5fa" }]}>WHERE</Text></View>
              <Text style={s.tagValue}>{sc.where}</Text>
            </View>
            <View style={s.tagRow}>
              <View style={[s.tag, { backgroundColor: "#f9731633" }]}><Text style={[s.tagText, { color: "#fb923c" }]}>WHAT</Text></View>
              <Text style={s.tagValue}>{sc.situation}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Text style={s.performText}>🎭 Perform this scenario live!</Text>

        {done ? (
          <View style={s.doneSection}>
            <Text style={s.doneText}>⏰ Scene! +300 pts</Text>
            <TouchableOpacity style={s.btn} onPress={nextScenario}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>{idx+1>=SCENARIOS.length ? "See Results" : "Next Scenario →"}</Text></LinearGradient></TouchableOpacity>
          </View>
        ) : (
          <View style={s.doneSection}>
            <TouchableOpacity style={s.btn} onPress={() => { clearInterval(timerRef.current!); finishRound(idx); }}>
              <LinearGradient colors={["#166534","#16a34a"]} style={s.btnI}><Text style={s.btnT}>✓ SCENE! (End Early)</Text></LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:20},
  rules:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:14,width:"100%",marginBottom:28},
  rule:{color:"#ccc",fontSize:13,marginBottom:5},
  btn:{borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12,alignItems:"center"}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:24},
  topBar:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, timerText:{fontSize:22,fontWeight:"900"},
  timerTrack:{height:6,backgroundColor:"#1e1e3a",overflow:"hidden"},
  timerFill:{height:"100%"},
  cardSection:{flex:1,paddingHorizontal:20,paddingVertical:24,justifyContent:"center"},
  scenarioCard:{borderRadius:20,padding:28,gap:20},
  tagRow:{flexDirection:"row",alignItems:"center",gap:12},
  tag:{borderRadius:6,paddingHorizontal:10,paddingVertical:4},
  tagText:{fontSize:10,fontWeight:"900",letterSpacing:1},
  tagValue:{color:"#fff",fontSize:17,fontWeight:"700",flex:1,lineHeight:24},
  performText:{color:"#888",fontSize:14,textAlign:"center",paddingBottom:8},
  doneSection:{paddingHorizontal:20,paddingBottom:32},
  doneText:{color:"#4ade80",fontSize:18,fontWeight:"900",textAlign:"center",marginBottom:16},
});
