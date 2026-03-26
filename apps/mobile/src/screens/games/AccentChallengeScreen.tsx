import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const ACCENTS = ["British", "Australian", "Southern American", "Valley Girl", "Pirate", "French", "Russian", "Yoda", "Robot", "Texan"];
const PHRASES = [
  "The quick brown fox jumps over the lazy dog",
  "Would you like some more tea and biscuits?",
  "I can't believe it's already midnight!",
  "Where did I put my car keys?",
  "This pizza is absolutely incredible",
  "Have you ever seen anything quite like this?",
  "The weather today is absolutely perfect",
  "I demand to speak to the manager immediately",
];

type Phase = "lobby" | "performing" | "rating" | "results";

export default function AccentChallengeScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpRated, setMpRated] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [round, setRound] = useState(0);
  const [accent, setAccent] = useState("");
  const [phrase, setPhrase] = useState("");
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (inRoom && mpState) {
    const mp = mpState;
    const isPerformer = mp.performer === myGuestId;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>🎤</Text>
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
        <LinearGradient colors={["#03001c","#001a10"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Round {(mp.round??0)+1}/{mp.maxRounds??5}</Text>
              <Text style={{color:"#fff",fontSize:22,fontWeight:"900"}}>{mp.timeLeft??30}s</Text>
            </View>
            <View style={{flex:1,paddingHorizontal:20,justifyContent:"center",alignItems:"center"}}>
              <Text style={{color:"#555",fontSize:11,fontWeight:"900",letterSpacing:2,marginBottom:10}}>YOUR ACCENT</Text>
              <View style={{backgroundColor:"rgba(181,23,158,0.2)",borderRadius:16,paddingHorizontal:24,paddingVertical:12,marginBottom:24}}>
                <Text style={{color:"#e879f9",fontSize:28,fontWeight:"900"}}>{mp.accent}</Text>
              </View>
              <Text style={{color:"#555",fontSize:11,fontWeight:"900",letterSpacing:2,marginBottom:10}}>SAY THIS PHRASE:</Text>
              <View style={{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:20,width:"100%",marginBottom:16}}>
                <Text style={{color:"#fff",fontSize:18,fontWeight:"700",textAlign:"center",lineHeight:26}}>"{mp.phrase}"</Text>
              </View>
              {!isPerformer && <Text style={{color:"#888",fontSize:13,textAlign:"center"}}>Listening to {memberName(mp.performer??"")}…</Text>}
            </View>
            {isPerformer && (
              <View style={{padding:20}}>
                <TouchableOpacity onPress={()=>sendAction("done",{})} style={{borderRadius:14,overflow:"hidden"}}>
                  <LinearGradient colors={["#166534","#16a34a"]} style={{padding:18,alignItems:"center"}}>
                    <Text style={{color:"#fff",fontSize:17,fontWeight:"900"}}>✓ DONE — Let them Rate!</Text>
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
        <LinearGradient colors={["#03001c","#001a10"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20}}>
              <Text style={{color:"#fff",fontSize:20,fontWeight:"900",marginBottom:8}}>Rate the accent!</Text>
              <Text style={{color:"#e879f9",fontSize:22,fontWeight:"800",marginBottom:24}}>{mp.accent}</Text>
              <View style={{flexDirection:"row",gap:8,width:"100%"}}>
                {[["😬 Bad",0,"#7f1d1d","#dc2626"],["😊 OK",100,"#854d0e","#ca8a04"],["👏 Good",200,"#1e40af","#3b82f6"],["🤩 Spot On!",350,"#166534","#16a34a"]].map(([label,pts,c1,c2])=>(
                  <TouchableOpacity key={label as string} onPress={()=>{if(!mpRated&&!isPerformer){setMpRated(true);sendAction("rate",{pts});}}} disabled={mpRated||isPerformer} style={{flex:1,borderRadius:12,overflow:"hidden"}}>
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
      <LinearGradient colors={["#03001c","#001a10"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const MAX_ROUNDS = 5;

  function startGame() { setPhase("performing"); setRound(0); setScore(0); loadRound(0); }

  function loadRound(r: number) {
    const acc = ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
    const phr = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    setAccent(acc); setPhrase(phr); setTimer(30);
    barAnim.setValue(1);
    Animated.timing(barAnim, { toValue: 0, duration: 30000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); setPhase("rating"); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function endEarly() { clearInterval(timerRef.current!); barAnim.stopAnimation(); setPhase("rating"); }

  function rate(pts: number) {
    setScore((s) => s + pts);
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= MAX_ROUNDS) setPhase("results");
    else { setPhase("performing"); loadRound(nextRound); }
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#001a10"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🗣️🌍</Text>
          <Text style={s.title}>Accent Challenge</Text>
          <Text style={s.sub}>Read a phrase in a random ridiculous accent — others rate your performance!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>SPEAK UP!</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <PostGameCard
      score={score}
      maxScore={600}
      gameEmoji="🗣️"
      gameTitle="Accent Challenge"
      onPlayAgain={startGame}
    />
  );

  if (phase === "performing") return (
    <LinearGradient colors={["#03001c","#001a10"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>Round {round+1}/{MAX_ROUNDS}</Text><Text style={[s.timerText, { color: timer <= 10 ? "#dc2626" : "#fff" }]}>{timer}s</Text></View>
        <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} /></View>
        <View style={s.accentSection}>
          <Text style={s.accentLabel}>YOUR ACCENT</Text>
          <View style={s.accentBadge}><Text style={s.accentText}>{accent}</Text></View>
          <Text style={s.phraseLabel}>SAY THIS PHRASE:</Text>
          <View style={s.phraseBox}><Text style={s.phraseText}>"{phrase}"</Text></View>
          <Text style={s.tip}>🎭 Commit to the accent. No holding back!</Text>
        </View>
        <View style={{ padding: 20 }}>
          <TouchableOpacity style={s.btn} onPress={endEarly}><LinearGradient colors={["#166534","#16a34a"]} style={s.btnI}><Text style={s.btnT}>✓ DONE — Let them Rate!</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <LinearGradient colors={["#03001c","#001a10"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={s.rateQ}>Rate the accent!</Text>
          <Text style={s.rateAccent}>{accent}</Text>
          <View style={s.rateRow}>
            <TouchableOpacity onPress={() => rate(0)} style={s.rateWrap} activeOpacity={0.85}>
              <LinearGradient colors={["#7f1d1d","#dc2626"]} style={s.rateBtn}><Text style={s.rateBtnT}>😬 Bad{"\n"}+0</Text></LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => rate(100)} style={s.rateWrap} activeOpacity={0.85}>
              <LinearGradient colors={["#854d0e","#ca8a04"]} style={s.rateBtn}><Text style={s.rateBtnT}>😊 OK{"\n"}+100</Text></LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => rate(200)} style={s.rateWrap} activeOpacity={0.85}>
              <LinearGradient colors={["#1e40af","#3b82f6"]} style={s.rateBtn}><Text style={s.rateBtnT}>👏 Good{"\n"}+200</Text></LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => rate(350)} style={s.rateWrap} activeOpacity={0.85}>
              <LinearGradient colors={["#166534","#16a34a"]} style={s.rateBtn}><Text style={s.rateBtnT}>🤩 Spot On!{"\n"}+350</Text></LinearGradient>
            </TouchableOpacity>
          </View>
          <Text style={s.scoreC}>Score so far: {score}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:24},
  topBar:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, timerText:{fontSize:22,fontWeight:"900"},
  timerTrack:{height:6,backgroundColor:"#1e1e3a",overflow:"hidden"},
  timerFill:{height:"100%",backgroundColor:"#b5179e"},
  accentSection:{flex:1,paddingHorizontal:20,justifyContent:"center",alignItems:"center"},
  accentLabel:{color:"#555",fontSize:11,fontWeight:"900",letterSpacing:2,marginBottom:10},
  accentBadge:{backgroundColor:"rgba(181,23,158,0.2)",borderRadius:16,paddingHorizontal:24,paddingVertical:12,marginBottom:24},
  accentText:{color:"#e879f9",fontSize:28,fontWeight:"900"},
  phraseLabel:{color:"#555",fontSize:11,fontWeight:"900",letterSpacing:2,marginBottom:10},
  phraseBox:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:20,width:"100%",marginBottom:16},
  phraseText:{color:"#fff",fontSize:18,fontWeight:"700",textAlign:"center",lineHeight:26},
  tip:{color:"#555",fontSize:13,textAlign:"center"},
  rateQ:{color:"#fff",fontSize:20,fontWeight:"900",marginBottom:8},
  rateAccent:{color:"#e879f9",fontSize:22,fontWeight:"800",marginBottom:24},
  rateRow:{flexDirection:"row",gap:8,width:"100%"},
  rateWrap:{flex:1,borderRadius:12,overflow:"hidden"},
  rateBtn:{padding:14,alignItems:"center"}, rateBtnT:{color:"#fff",fontSize:12,fontWeight:"900",textAlign:"center"},
  scoreC:{color:"#a78bfa",fontSize:15,fontWeight:"800",marginTop:16},
});
