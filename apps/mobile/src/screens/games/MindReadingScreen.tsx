import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const PATTERNS = [
  { seq: [2, 4, 6, 8, "?"], answer: 10, rule: "Add 2 each time" },
  { seq: [1, 3, 9, 27, "?"], answer: 81, rule: "Multiply by 3" },
  { seq: [100, 50, 25, "?"], answer: 12.5, rule: "Divide by 2" },
  { seq: [1, 1, 2, 3, 5, "?"], answer: 8, rule: "Fibonacci! Add previous two" },
  { seq: [3, 6, 12, 24, "?"], answer: 48, rule: "Multiply by 2" },
  { seq: [10, 8, 6, 4, "?"], answer: 2, rule: "Subtract 2 each time" },
  { seq: [2, 4, 8, 16, "?"], answer: 32, rule: "Double each time" },
  { seq: [1, 4, 9, 16, "?"], answer: 25, rule: "Perfect squares: 1², 2², 3², 4²…" },
];

type Phase = "lobby" | "playing" | "results";

export default function MindReadingScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpAnswered, setMpAnswered] = useState(false);

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>🧠</Text>
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
      const opts: number[] = mp.options ?? [];
      const correctVal = mp.correctAnswer;
      return (
        <LinearGradient colors={["#03001c","#100020"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Question {(mp.questionIndex??0)+1}</Text>
              <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.scores?.[myGuestId??""]} pts</Text>
            </View>
            <View style={{flex:1,paddingHorizontal:20,justifyContent:"center",alignItems:"center"}}>
              <Text style={{color:"#888",fontSize:14,fontWeight:"700",marginBottom:20}}>What comes next?</Text>
              <View style={{flexDirection:"row",gap:8,flexWrap:"wrap",justifyContent:"center",marginBottom:24}}>
                {(mp.sequence??[]).map((v:any,i:number)=>(
                  <View key={i} style={{width:52,height:52,backgroundColor:typeof v==="string"?"rgba(181,23,158,0.2)":"#1a1a3a",borderRadius:12,alignItems:"center",justifyContent:"center",borderWidth:typeof v==="string"?2:0,borderColor:"#b5179e"}}>
                    <Text style={{color:typeof v==="string"?"#b5179e":"#ccc",fontSize:18,fontWeight:"800"}}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{paddingHorizontal:20,gap:10,paddingBottom:20}}>
              {opts.map((opt,i)=>(
                <TouchableOpacity key={i} onPress={()=>{if(!mpAnswered){setMpAnswered(true);sendAction("answer",{value:opt});}}} disabled={mpAnswered} activeOpacity={0.8} style={{borderRadius:14,overflow:"hidden"}}>
                  <LinearGradient colors={["#1a1a3a","#2a1a4a"]} style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:16}}>
                    <Text style={{color:"#fff",fontSize:20,fontWeight:"800"}}>{opt}</Text>
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
      return (
        <LinearGradient colors={["#03001c","#100020"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{color:"#fff",fontSize:20,fontWeight:"900",marginBottom:8}}>Answer: {mp.correctAnswer}</Text>
              {mp.rule && <Text style={{color:"#fbbf24",fontSize:14,marginBottom:20}}>Rule: {mp.rule}</Text>}
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

    return (
      <LinearGradient colors={["#03001c","#100020"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [options, setOptions] = useState<number[]>([]);
  const [selected, setSelected] = useState<number|null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); loadPuzzle(0); }

  function loadPuzzle(i: number) {
    const p = PATTERNS[i];
    const correct = Number(p.answer);
    const wrong = [correct + 2, correct - 3, correct * 2].filter((v) => v !== correct && v > 0);
    const opts = [correct, ...wrong.slice(0, 3)].sort(() => Math.random() - 0.5);
    setOptions(opts);
    setSelected(null); setRevealed(false); setTimer(15);
    barAnim.setValue(1);
    Animated.timing(barAnim, { toValue: 0, duration: 15000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); doReveal(i, null); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function pick(val: number, i: number) {
    if (revealed) return;
    clearInterval(timerRef.current!); barAnim.stopAnimation();
    setSelected(val);
    doReveal(i, val);
  }

  function doReveal(i: number, val: number|null) {
    setRevealed(true);
    const correct = val !== null && Number(PATTERNS[i].answer) === val;
    if (correct) setScore((s) => s + 100 + timer * 20);
    setTimeout(() => {
      if (i + 1 >= PATTERNS.length) setPhase("results");
      else { setIdx(i+1); loadPuzzle(i+1); }
    }, 1500);
  }

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#100020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🧠</Text>
          <Text style={s.title}>Mind Reading</Text>
          <Text style={s.sub}>Figure out the pattern in the sequence and predict the next number!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>THINK FAST</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") {
    return (
      <PostGameCard
        score={score}
        maxScore={1000}
        gameEmoji="🔮"
        gameTitle="Mind Reading"
        onPlayAgain={startGame}
      />
    );
  }

  const p = PATTERNS[idx];
  const correctVal = Number(p.answer);
  return (
    <LinearGradient colors={["#03001c","#100020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topRow}>
          <Text style={s.prog}>{idx+1}/{PATTERNS.length}</Text>
          <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} /></View>
          <Text style={s.timerNum}>{timer}s</Text>
        </View>
        <View style={s.seqSection}>
          <Text style={s.seqLabel}>What comes next?</Text>
          <View style={s.seqRow}>
            {p.seq.map((v, i) => (
              <View key={i} style={[s.seqBox, typeof v === "string" && s.seqBoxQuestion]}>
                <Text style={[s.seqNum, typeof v === "string" && s.seqQuestion]}>{v}</Text>
              </View>
            ))}
          </View>
          {revealed && <Text style={s.ruleReveal}>💡 Rule: {p.rule}</Text>}
        </View>
        <View style={s.opts}>
          {options.map((opt, i) => {
            const isSelected = selected === opt;
            const isCorrect = opt === correctVal;
            let colors: string[] = ["#1a1a3a","#2a1a4a"];
            if (revealed) { if (isCorrect) colors = ["#166534","#16a34a"]; else if (isSelected) colors = ["#7f1d1d","#991b1b"]; }
            return (
              <TouchableOpacity key={i} onPress={() => pick(opt, idx)} disabled={revealed} activeOpacity={0.8} style={s.optWrap}>
                <LinearGradient colors={colors as any} style={s.optCard}>
                  <Text style={s.optText}>{opt}</Text>
                  {revealed && isCorrect && <Text style={{ color: "#4ade80" }}>✓</Text>}
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
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:12,gap:10},
  prog:{color:"#888",fontSize:13,fontWeight:"700",width:50},
  timerTrack:{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"},
  timerFill:{height:"100%",backgroundColor:"#a78bfa",borderRadius:3},
  timerNum:{color:"#fff",fontSize:14,fontWeight:"900",width:28},
  seqSection:{flex:1,paddingHorizontal:20,justifyContent:"center",alignItems:"center"},
  seqLabel:{color:"#888",fontSize:14,fontWeight:"700",marginBottom:20},
  seqRow:{flexDirection:"row",gap:8,flexWrap:"wrap",justifyContent:"center"},
  seqBox:{width:52,height:52,backgroundColor:"#1a1a3a",borderRadius:12,alignItems:"center",justifyContent:"center"},
  seqBoxQuestion:{backgroundColor:"rgba(181,23,158,0.2)",borderWidth:2,borderColor:"#b5179e"},
  seqNum:{color:"#ccc",fontSize:18,fontWeight:"800"}, seqQuestion:{color:"#b5179e",fontSize:24,fontWeight:"900"},
  ruleReveal:{color:"#fbbf24",fontSize:13,marginTop:16,textAlign:"center"},
  opts:{paddingHorizontal:20,gap:10,paddingBottom:8},
  optWrap:{borderRadius:14,overflow:"hidden"},
  optCard:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:16,borderRadius:14},
  optText:{color:"#fff",fontSize:20,fontWeight:"800"},
  scoreBar:{padding:16,alignItems:"center"}, scoreText:{color:"#a78bfa",fontSize:15,fontWeight:"800"},
});
