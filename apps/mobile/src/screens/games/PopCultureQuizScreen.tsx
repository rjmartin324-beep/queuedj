import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const QUESTIONS = [
  { q: "Which show features the phrase 'Winter is Coming'?", opts: ["The Crown", "Vikings", "Game of Thrones", "Merlin"], a: 2, category: "TV" },
  { q: "What year did 'Avengers: Endgame' release?", opts: ["2017", "2018", "2019", "2020"], a: 2, category: "Film" },
  { q: "Who sang 'Old Town Road' feat. Billy Ray Cyrus?", opts: ["Travis Scott", "Lil Nas X", "21 Savage", "Cardi B"], a: 1, category: "Music" },
  { q: "What is the highest-grossing animated film of all time?", opts: ["Frozen II", "The Lion King", "Incredibles 2", "Minions"], a: 1, category: "Film" },
  { q: "Which platform launched in 2016 before merging with TikTok?", opts: ["Vine", "Dubsmash", "Musical.ly", "Triller"], a: 2, category: "Social" },
  { q: "In Squid Game, what shape is the dalgona candy from the hardest challenge?", opts: ["Star", "Circle", "Triangle", "Umbrella"], a: 3, category: "TV" },
  { q: "Who holds the record for most Grammy wins?", opts: ["Michael Jackson", "Taylor Swift", "Beyoncé", "Adele"], a: 2, category: "Music" },
  { q: "What country does K-Pop originate from?", opts: ["Japan", "China", "Vietnam", "South Korea"], a: 3, category: "Music" },
  { q: "Which Marvel character says 'I am Groot'?", opts: ["Rocket", "Groot", "Thanos", "Drax"], a: 1, category: "Film" },
  { q: "What is the name of Tony Stark's AI assistant?", opts: ["JARVIS", "FRIDAY", "VISION", "ULTRON"], a: 0, category: "Film" },
];

const CATEGORY_COLORS: Record<string, string> = {
  TV: "#3b82f6",
  Film: "#b5179e",
  Music: "#f97316",
  Social: "#22d3ee",
};

type Phase = "lobby" | "playing" | "results";

export default function PopCultureQuizScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpAnswered, setMpAnswered] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number|null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(12);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>🎬</Text>
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

    if (mp.phase === "question") {
      const catColor = CATEGORY_COLORS[mp.category] ?? "#a78bfa";
      const opts: string[] = mp.options ?? [];
      return (
        <LinearGradient colors={["#03001c","#0a001a"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:12,gap:10}}>
              <Text style={{color:"#888",fontSize:13,fontWeight:"700",width:50}}>Q{(mp.questionIndex??0)+1}</Text>
              <View style={{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"}}>
                <View style={{height:"100%",backgroundColor:catColor,width:`${(mp.timeLeft??12)/12*100}%`,borderRadius:3}} />
              </View>
              <Text style={{color:"#fff",fontSize:14,fontWeight:"900",width:28}}>{mp.timeLeft??12}s</Text>
            </View>
            {mp.category && (
              <View style={{alignSelf:"flex-start",marginHorizontal:20,borderRadius:8,paddingHorizontal:12,paddingVertical:4,marginBottom:8,backgroundColor:catColor+"22"}}>
                <Text style={{fontSize:11,fontWeight:"900",letterSpacing:1,color:catColor}}>{mp.category}</Text>
              </View>
            )}
            <View style={{paddingHorizontal:20,paddingVertical:20,flex:1,justifyContent:"center"}}>
              <Text style={{color:"#fff",fontSize:20,fontWeight:"800",textAlign:"center",lineHeight:28}}>{mp.question}</Text>
            </View>
            <View style={{paddingHorizontal:16,gap:8,paddingBottom:16}}>
              {opts.map((opt,i)=>(
                <TouchableOpacity key={i} onPress={()=>{if(!mpAnswered){setMpAnswered(true);sendAction("answer",{index:i});}}} disabled={mpAnswered} activeOpacity={0.8} style={{borderRadius:14,overflow:"hidden"}}>
                  <LinearGradient colors={["#1a1a3a","#2a1a4a"]} style={{flexDirection:"row",alignItems:"center",padding:14,gap:10}}>
                    <Text style={{color:"#a78bfa",fontSize:15,fontWeight:"900",width:22}}>{["A","B","C","D"][i]}</Text>
                    <Text style={{color:"#fff",fontSize:14,fontWeight:"600",flex:1}}>{opt}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
            {mpAnswered && <Text style={{color:"#a78bfa",textAlign:"center",padding:12,fontWeight:"700"}}>⏳ Waiting…</Text>}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "reveal") {
      const catColor = CATEGORY_COLORS[mp.category] ?? "#a78bfa";
      const opts: string[] = mp.options ?? [];
      return (
        <LinearGradient colors={["#03001c","#0a001a"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24}}>
              <Text style={{color:"#fff",fontSize:18,fontWeight:"800",textAlign:"center",marginBottom:16}}>{mp.question}</Text>
              <View style={{gap:8,marginBottom:20}}>
                {opts.map((opt,i)=>{
                  const isCorrect = i===mp.correctIndex;
                  return (
                    <View key={i} style={{borderRadius:14,overflow:"hidden"}}>
                      <LinearGradient colors={isCorrect?["#166534","#16a34a"]:["#1a1a3a","#2a1a4a"]} style={{flexDirection:"row",alignItems:"center",padding:14,gap:10}}>
                        <Text style={{color:isCorrect?"#4ade80":"#a78bfa",fontSize:15,fontWeight:"900",width:22}}>{["A","B","C","D"][i]}</Text>
                        <Text style={{color:"#fff",fontSize:14,fontWeight:"600",flex:1}}>{opt}</Text>
                        {isCorrect && <Text style={{color:"#4ade80"}}>✓</Text>}
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>
              {Object.entries(mp.scores||{}).sort(([,a],[,b])=>(b as number)-(a as number)).map(([gId,pts],i)=>(
                <View key={gId} style={{flexDirection:"row",justifyContent:"space-between",marginBottom:8}}>
                  <Text style={{color:"#ccc",fontSize:15}}>{i+1}. {memberName(gId)}</Text>
                  <Text style={{color:"#a78bfa",fontSize:15,fontWeight:"700"}}>{pts as number} pts</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c","#0a001a"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); loadQuestion(0); }

  function loadQuestion(i: number) {
    setSelected(null); setAnswered(false); setTimer(12);
    barAnim.setValue(1); fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    Animated.timing(barAnim, { toValue: 0, duration: 12000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); setAnswered(true); advance(i); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function answer(optIdx: number, qIdx: number) {
    if (answered) return;
    clearInterval(timerRef.current!);
    barAnim.stopAnimation();
    setSelected(optIdx); setAnswered(true);
    if (optIdx === QUESTIONS[qIdx].a) setScore((s) => s + 100 + timer * 25);
    advance(qIdx);
  }

  function advance(i: number) {
    setTimeout(() => {
      if (i + 1 >= QUESTIONS.length) setPhase("results");
      else { loadQuestion(i + 1); setIdx(i + 1); }
    }, 1200);
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#0a001a"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🎬🎵📱</Text>
          <Text style={s.title}>Pop Culture Quiz</Text>
          <Text style={s.sub}>Movies, music, TV, social media — 10 rounds, 12 seconds each</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START QUIZ</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <PostGameCard
      score={score}
      maxScore={3000}
      gameEmoji="🎬"
      gameTitle="Pop Culture Quiz"
      onPlayAgain={startGame}
    />
  );

  const q = QUESTIONS[Math.min(idx, QUESTIONS.length - 1)];
  const catColor = CATEGORY_COLORS[q.category] ?? "#a78bfa";
  return (
    <LinearGradient colors={["#03001c","#0a001a"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topRow}>
          <Text style={s.prog}>{Math.min(idx+1,QUESTIONS.length)}/{QUESTIONS.length}</Text>
          <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }), backgroundColor: timer <= 4 ? "#dc2626" : catColor }]} /></View>
          <Text style={s.timerNum}>{timer}s</Text>
        </View>
        <View style={[s.catBadge, { backgroundColor: catColor + "22" }]}><Text style={[s.catText, { color: catColor }]}>{q.category}</Text></View>
        <Animated.View style={[s.qSection, { opacity: fadeAnim }]}>
          <Text style={s.questionText}>{q.q}</Text>
        </Animated.View>
        <View style={s.opts}>
          {q.opts.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = q.a === i;
            let colors: string[] = ["#1a1a3a","#2a1a4a"];
            if (answered) { if (isCorrect) colors = ["#166534","#16a34a"]; else if (isSelected) colors = ["#7f1d1d","#991b1b"]; }
            return (
              <TouchableOpacity key={i} onPress={() => answer(i, idx)} disabled={answered} activeOpacity={0.8} style={s.optWrap}>
                <LinearGradient colors={colors as any} style={s.optCard}>
                  <Text style={s.optLetter}>{["A","B","C","D"][i]}</Text>
                  <Text style={s.optText}>{opt}</Text>
                  {answered && isCorrect && <Text style={{ color: "#4ade80" }}>✓</Text>}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.scoreBar}><Text style={s.scoreText}>Score: {score}</Text></View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:30,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:12,gap:10},
  prog:{color:"#888",fontSize:13,fontWeight:"700",width:50},
  timerTrack:{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"},
  timerFill:{height:"100%",borderRadius:3},
  timerNum:{color:"#fff",fontSize:14,fontWeight:"900",width:28},
  catBadge:{alignSelf:"flex-start",marginHorizontal:20,borderRadius:8,paddingHorizontal:12,paddingVertical:4,marginBottom:8},
  catText:{fontSize:11,fontWeight:"900",letterSpacing:1},
  qSection:{paddingHorizontal:20,paddingVertical:20,flex:1,justifyContent:"center"},
  questionText:{color:"#fff",fontSize:20,fontWeight:"800",textAlign:"center",lineHeight:28},
  opts:{paddingHorizontal:16,gap:8},
  optWrap:{borderRadius:14,overflow:"hidden"},
  optCard:{flexDirection:"row",alignItems:"center",padding:14,gap:10},
  optLetter:{color:"#a78bfa",fontSize:15,fontWeight:"900",width:22},
  optText:{color:"#fff",fontSize:14,fontWeight:"600",flex:1},
  scoreBar:{padding:16,alignItems:"center"}, scoreText:{color:"#a78bfa",fontSize:15,fontWeight:"800"},
});
