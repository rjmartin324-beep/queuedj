import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const TEXTS = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "The five boxing wizards jump quickly",
  "Sphinx of black quartz judge my vow",
];

type Phase = "lobby" | "playing" | "results";

export default function SpeedTypingScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpTyped, setMpTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [textIdx, setTextIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [timer, setTimer] = useState(30);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>⌨️</Text>
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

    if (mp.phase === "typing") {
      const target: string = mp.text ?? "";
      return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex:1}}>
          <LinearGradient colors={["#03001c","#002010"]} style={{flex:1}}>
            <SafeAreaView style={{flex:1}}>
              <View style={{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:12,gap:10}}>
                <Text style={{color:"#888",fontSize:13,fontWeight:"700",width:50}}>R{(mp.round??0)+1}/{mp.maxRounds??3}</Text>
                <View style={{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"}}>
                  <View style={{height:"100%",backgroundColor:"#22d3ee",width:`${(mp.timeLeft??30)/30*100}%`,borderRadius:3}} />
                </View>
                <Text style={{color:"#fff",fontSize:14,fontWeight:"900",width:28}}>{mp.timeLeft??30}s</Text>
              </View>
              <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,marginBottom:8}}>
                <Text style={{color:"#888",fontSize:14}}>Score: <Text style={{color:"#b5179e"}}>{mp.scores?.[myGuestId??""]} pts</Text></Text>
              </View>
              <View style={{marginHorizontal:20,backgroundColor:"#0a0a1a",borderRadius:14,padding:16,marginBottom:16,flexDirection:"row",flexWrap:"wrap",minHeight:80}}>
                {target.split("").map((char,i)=>{
                  let color="#666";
                  if(i<mpTyped.length) color=mpTyped[i]===char?"#4ade80":"#f87171";
                  return <Text key={i} style={{fontSize:18,lineHeight:28,color}}>{char}</Text>;
                })}
              </View>
              <View style={{paddingHorizontal:20,paddingBottom:24}}>
                <TextInput
                  style={{backgroundColor:"#1a1a3a",borderRadius:14,paddingHorizontal:16,paddingVertical:14,color:"#fff",fontSize:16,height:56}}
                  value={mpTyped}
                  onChangeText={(val)=>{
                    setMpTyped(val);
                    if(val.trim().toLowerCase()===target.trim().toLowerCase()){
                      sendAction("complete",{wpm:Math.round(val.split(" ").length/((30-(mp.timeLeft??30)+1))*60)});
                    }
                  }}
                  placeholder="Start typing here…"
                  placeholderTextColor="#333"
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                />
              </View>
            </SafeAreaView>
          </LinearGradient>
        </KeyboardAvoidingView>
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

  const MAX_ROUNDS = 3;

  function startGame() { setPhase("playing"); setRound(0); setScore(0); loadRound(0); }

  function loadRound(r: number) {
    setTyped(""); setTimer(30); setAccuracy(100);
    setTextIdx(r % TEXTS.length);
    barAnim.setValue(1);
    Animated.timing(barAnim, { toValue: 0, duration: 30000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); endRound(); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function handleTyping(val: string) {
    setTyped(val);
    const target = TEXTS[textIdx];
    // Calculate accuracy
    let correct = 0;
    for (let i = 0; i < Math.min(val.length, target.length); i++) {
      if (val[i] === target[i]) correct++;
    }
    const acc = val.length > 0 ? Math.round((correct / val.length) * 100) : 100;
    setAccuracy(acc);

    if (val.trim().toLowerCase() === target.trim().toLowerCase()) {
      clearInterval(timerRef.current!); barAnim.stopAnimation();
      const wpm = Math.round((val.split(" ").length / (30 - timer + 1)) * 60);
      const pts = Math.round(wpm * 10 * (acc / 100));
      setScore((s) => s + pts);
      endRound();
    }
  }

  function endRound() {
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= MAX_ROUNDS) setPhase("results");
    else setTimeout(() => loadRound(nextRound), 500);
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#002010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>⌨️⚡</Text>
          <Text style={s.title}>Speed Typing</Text>
          <Text style={s.sub}>Type the phrase as fast and accurately as possible. WPM × accuracy = your score!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START TYPING</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#002010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>⌨️</Text>
          <Text style={s.title}>Typing Complete!</Text>
          <Text style={s.bigScore}>{score}</Text>
          <Text style={s.label}>TOTAL SCORE</Text>
          <Text style={s.verdict}>{score >= 2000 ? "⚡ Keyboard God!" : score >= 1200 ? "💻 Fast Typer" : score >= 600 ? "🙂 Getting Faster" : "🐢 Two-Finger Typer?"}</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>PLAY AGAIN</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  const target = TEXTS[textIdx];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c","#002010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topRow}>
            <Text style={s.prog}>{round+1}/{MAX_ROUNDS}</Text>
            <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} /></View>
            <Text style={s.timerNum}>{timer}s</Text>
          </View>
          <View style={s.statsRow}>
            <Text style={s.stat}>Accuracy: <Text style={{ color: accuracy >= 90 ? "#4ade80" : accuracy >= 70 ? "#fbbf24" : "#f87171" }}>{accuracy}%</Text></Text>
            <Text style={s.stat}>Score: <Text style={{ color: "#b5179e" }}>{score}</Text></Text>
          </View>
          <View style={s.targetBox}>
            {target.split("").map((char, i) => {
              let color = "#666";
              if (i < typed.length) color = typed[i] === char ? "#4ade80" : "#f87171";
              return <Text key={i} style={[s.targetChar, { color }]}>{char}</Text>;
            })}
          </View>
          <View style={s.inputSection}>
            <TextInput
              style={s.input}
              value={typed}
              onChangeText={handleTyping}
              placeholder="Start typing here…"
              placeholderTextColor="#333"
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
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
  timerFill:{height:"100%",backgroundColor:"#22d3ee",borderRadius:3},
  timerNum:{color:"#fff",fontSize:14,fontWeight:"900",width:28},
  statsRow:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,marginBottom:8},
  stat:{color:"#888",fontSize:14},
  targetBox:{marginHorizontal:20,backgroundColor:"#0a0a1a",borderRadius:14,padding:16,marginBottom:16,flexDirection:"row",flexWrap:"wrap",minHeight:80},
  targetChar:{fontSize:18,lineHeight:28},
  inputSection:{paddingHorizontal:20,paddingBottom:24},
  input:{backgroundColor:"#1a1a3a",borderRadius:14,paddingHorizontal:16,paddingVertical:14,color:"#fff",fontSize:16,height:56},
});
