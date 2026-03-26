import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

// Photo Bomb: spot the odd one out in a group of emojis
const PUZZLES = [
  { grid: ["🐱","🐱","🐱","🐱","🐱","🐱","🐱","🐱","🐶","🐱","🐱","🐱"], odd: 8, label: "Find the dog!" },
  { grid: ["🍎","🍎","🍎","🍎","🍊","🍎","🍎","🍎","🍎","🍎","🍎","🍎"], odd: 4, label: "Find the orange!" },
  { grid: ["⭐","⭐","⭐","⭐","⭐","⭐","⭐","⭐","⭐","☀️","⭐","⭐"], odd: 9, label: "Find the sun!" },
  { grid: ["🔵","🔵","🔵","🔵","🔵","🔵","🔴","🔵","🔵","🔵","🔵","🔵"], odd: 6, label: "Find the red dot!" },
  { grid: ["😀","😀","😀","😀","😀","😀","😀","😀","😀","😀","😡","😀"], odd: 10, label: "Find the angry face!" },
  { grid: ["🌿","🌿","🌿","🌿","🌿","🌸","🌿","🌿","🌿","🌿","🌿","🌿"], odd: 5, label: "Find the flower!" },
  { grid: ["🎵","🎵","🎵","🎵","🎵","🎵","🎵","🎵","🎵","🎵","🎸","🎵"], odd: 10, label: "Find the guitar!" },
  { grid: ["🏠","🏠","🏠","🏠","🏠","🏠","🏠","🏠","🏰","🏠","🏠","🏠"], odd: 8, label: "Find the castle!" },
];

type Phase = "lobby" | "playing" | "results";

export default function PhotoBombScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpTapped, setMpTapped] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number|null>(null);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(10);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>👀</Text>
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
      const grid: string[] = mp.grid ?? [];
      const oddIdx: number = mp.odd ?? -1;
      return (
        <LinearGradient colors={["#03001c","#002010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:12,gap:10}}>
              <Text style={{color:"#888",fontSize:13,fontWeight:"700",width:50}}>Q{(mp.questionIndex??0)+1}</Text>
              <View style={{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"}}>
                <View style={{height:"100%",backgroundColor:mp.timeLeft<=3?"#dc2626":"#22d3ee",width:`${(mp.timeLeft??10)/10*100}%`,borderRadius:3}} />
              </View>
              <Text style={{color:"#fff",fontSize:14,fontWeight:"900",width:28}}>{mp.timeLeft??10}s</Text>
            </View>
            {mp.label && <Text style={{color:"#888",fontSize:14,fontWeight:"700",textAlign:"center",paddingTop:8,paddingHorizontal:20}}>{mp.label}</Text>}
            <View style={{flexDirection:"row",flexWrap:"wrap",paddingHorizontal:16,paddingTop:16,gap:8,justifyContent:"center",flex:1,alignContent:"center"}}>
              {grid.map((emoji,i)=>(
                <TouchableOpacity key={i} onPress={()=>{if(!mpTapped){setMpTapped(true);sendAction("tap",{index:i});}}} disabled={mpTapped} style={{width:72,height:72,backgroundColor:"#1a1a3a",borderRadius:14,alignItems:"center",justifyContent:"center"}} activeOpacity={0.7}>
                  <Text style={{fontSize:32}}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{padding:16,alignItems:"center"}}>
              <Text style={{color:"#a78bfa",fontSize:14,fontWeight:"800"}}>Score: {mp.scores?.[myGuestId??""]} pts</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c","#002010"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); loadPuzzle(0); }

  function loadPuzzle(i: number) {
    setSelected(null); setTimer(10); barAnim.setValue(1);
    Animated.timing(barAnim, { toValue: 0, duration: 10000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); advance(i, null); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function tap(itemIdx: number, puzzleIdx: number) {
    if (selected !== null) return;
    clearInterval(timerRef.current!); barAnim.stopAnimation();
    setSelected(itemIdx);
    const correct = itemIdx === PUZZLES[puzzleIdx].odd;
    if (correct) setScore((s) => s + 100 + timer * 30);
    setTimeout(() => advance(puzzleIdx, itemIdx), 1000);
  }

  function advance(puzzleIdx: number, _: number|null) {
    if (puzzleIdx + 1 >= PUZZLES.length) setPhase("results");
    else { setIdx(puzzleIdx + 1); loadPuzzle(puzzleIdx + 1); }
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#002010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🔍📸</Text>
          <Text style={s.title}>Photo Bomb</Text>
          <Text style={s.sub}>Spot the one emoji that doesn't belong in the grid — tap it as fast as possible!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>FIND IT!</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") {
    const pct = Math.round((score / (PUZZLES.length * 400)) * 100);
    return (
      <LinearGradient colors={["#03001c","#002010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>👀</Text>
            <Text style={s.title}>Observation Complete!</Text>
            <Text style={s.bigScore}>{score}</Text>
            <Text style={s.label}>POINTS</Text>
            <Text style={s.verdict}>{pct >= 80 ? "🦅 Eagle Eye!" : pct >= 60 ? "👁️ Sharp" : pct >= 40 ? "🙂 Getting there" : "😅 Keep looking"}</Text>
            <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>PLAY AGAIN</Text></LinearGradient></TouchableOpacity>
            <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const puzzle = PUZZLES[idx];
  return (
    <LinearGradient colors={["#03001c","#002010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topRow}>
          <Text style={s.prog}>{idx+1}/{PUZZLES.length}</Text>
          <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }), backgroundColor: timer <= 3 ? "#dc2626" : "#22d3ee" }]} /></View>
          <Text style={s.timerNum}>{timer}s</Text>
        </View>
        <Text style={s.label}>{puzzle.label}</Text>
        <View style={s.grid}>
          {puzzle.grid.map((emoji, i) => {
            const isSelected = selected === i;
            const isCorrect = i === puzzle.odd;
            return (
              <TouchableOpacity
                key={i} onPress={() => tap(i, idx)} disabled={selected !== null}
                style={[s.cell,
                  selected !== null && isCorrect && s.cellCorrect,
                  selected !== null && isSelected && !isCorrect && s.cellWrong,
                ]}
                activeOpacity={0.7}
              >
                <Text style={s.emoji}>{emoji}</Text>
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
  homeBtn:{padding:12,alignItems:"center"}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#888",fontSize:14,fontWeight:"700",textAlign:"center",paddingTop:12,paddingHorizontal:20},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:12,gap:10},
  prog:{color:"#888",fontSize:13,fontWeight:"700",width:50},
  timerTrack:{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"},
  timerFill:{height:"100%",borderRadius:3},
  timerNum:{color:"#fff",fontSize:14,fontWeight:"900",width:28},
  grid:{flexDirection:"row",flexWrap:"wrap",paddingHorizontal:16,paddingTop:16,gap:8,justifyContent:"center"},
  cell:{width:72,height:72,backgroundColor:"#1a1a3a",borderRadius:14,alignItems:"center",justifyContent:"center"},
  cellCorrect:{backgroundColor:"rgba(22,163,74,0.3)",borderWidth:2,borderColor:"#16a34a"},
  cellWrong:{backgroundColor:"rgba(220,38,38,0.3)",borderWidth:2,borderColor:"#dc2626"},
  emoji:{fontSize:32},
  scoreBar:{padding:16,alignItems:"center"}, scoreText:{color:"#a78bfa",fontSize:14,fontWeight:"800"},
});
